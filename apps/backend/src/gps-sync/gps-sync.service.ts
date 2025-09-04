import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VehicleMapperService } from '../common/helpers/vehicle-mapper';
import { createTimescalePool } from '../common/config/timescale.config';
import * as mysql from 'mysql2/promise';
import { Pool } from 'pg';
import * as crypto from 'crypto';

interface SyncParams {
  vehicleId?: number | null;  // sada je vehicle ID broj
  vehicleIds?: number[] | null;  // lista vehicle ID-eva
  startDate: string;
  endDate: string;
  batchSize: number;
  delay: number;
}

@Injectable()
export class GpsSyncService {
  private readonly logger = new Logger(GpsSyncService.name);
  private isRunning = false;
  private currentSyncId: number | null = null;
  private shouldStop = false;
  private pgPool: Pool | null = null;

  constructor(
    private prisma: PrismaService,
    private vehicleMapper: VehicleMapperService,
  ) {}

  async startSync(userId: number, params: SyncParams) {
    if (this.isRunning) {
      throw new Error('GPS sinhronizacija već u toku');
    }

    // Loguj primljene parametre
    this.logger.log('📥 GPS Sync parametri primljeni:', {
      vehicleId: params.vehicleId,
      vehicleIds: params.vehicleIds,
      startDate: params.startDate,
      endDate: params.endDate,
      batchSize: params.batchSize,
      delay: params.delay,
      startDateParsed: new Date(params.startDate).toLocaleString('sr-RS'),
      endDateParsed: new Date(params.endDate).toLocaleString('sr-RS'),
    });

    this.isRunning = true;
    this.shouldStop = false;

    // Odredi opis vozila za log - konvertuj ID-eve u garage numbers za prikaz
    let vehicleDescription: string | null = null;
    if (params.vehicleIds && params.vehicleIds.length > 0) {
      const garageMap = await this.vehicleMapper.mapIdsToGarageNumbers(params.vehicleIds.slice(0, 5));
      const garageNumbers = params.vehicleIds.slice(0, 5).map(id => garageMap.get(id) || `ID:${id}`);
      vehicleDescription = `${params.vehicleIds.length} vozila: ${garageNumbers.join(', ')}${params.vehicleIds.length > 5 ? '...' : ''}`;
    } else if (params.vehicleId) {
      const garageNumber = await this.vehicleMapper.idToGarageNumber(params.vehicleId);
      vehicleDescription = garageNumber;
    }

    // Kreiraj log u bazi
    const syncLog = await this.prisma.gpsSyncLog.create({
      data: {
        userId,
        vehicleGarageNo: vehicleDescription,
        syncStartDate: new Date(params.startDate),
        syncEndDate: new Date(params.endDate),
        status: 'in_progress',
        totalPoints: 0,
        processedPoints: 0,
        insertedPoints: 0,
        updatedPoints: 0,
        skippedPoints: 0,
        errorPoints: 0,
        batchSize: params.batchSize,
        delayMs: params.delay,
        startedAt: new Date(),
      },
    });

    this.currentSyncId = syncLog.id;

    // Pokreni asinhronu sinhronizaciju
    this.performSync(syncLog.id, params).catch(error => {
      this.logger.error('Greška u GPS sinhronizaciji:', error);
      this.updateSyncStatus(syncLog.id, 'failed', error.message);
    }).finally(() => {
      this.isRunning = false;
      this.currentSyncId = null;
    });

    return {
      success: true,
      message: 'GPS sinhronizacija pokrenuta',
      syncId: syncLog.id,
    };
  }

  async stopSync() {
    // Postavi flag za zaustavljanje
    this.shouldStop = true;
    this.logger.log('🛑 Postavljam shouldStop = true');
    
    if (!this.isRunning && !this.currentSyncId) {
      // Pokušaj da zaustavi sve aktivne sinhronizacije u bazi
      const activeSyncs = await this.prisma.gpsSyncLog.updateMany({
        where: {
          status: { in: ['in_progress', 'pending'] },
        },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
          error: 'Ručno zaustavljena sinhronizacija',
        },
      });

      if (activeSyncs.count === 0) {
        throw new Error('Nema aktivne GPS sinhronizacije');
      }

      return {
        success: true,
        message: `Zaustavljeno ${activeSyncs.count} sinhronizacija`,
      };
    }

    if (this.currentSyncId) {
      this.logger.log(`🛑 Zaustavljam sinhronizaciju ID: ${this.currentSyncId}`);
      await this.updateSyncStatus(this.currentSyncId, 'cancelled');
      // Očisti trenutni sync ID
      const tempId = this.currentSyncId;
      this.currentSyncId = null;
      this.isRunning = false;
      
      this.logger.log(`✅ Sinhronizacija ID ${tempId} je zaustavljena`);
    }

    return {
      success: true,
      message: 'GPS sinhronizacija je zaustavljena',
    };
  }

  async stopSyncById(syncId: number) {
    const syncLog = await this.prisma.gpsSyncLog.findUnique({
      where: { id: syncId },
    });

    if (!syncLog) {
      throw new Error('Sinhronizacija nije pronađena');
    }

    if (syncLog.status !== 'in_progress' && syncLog.status !== 'pending') {
      throw new Error('Sinhronizacija nije aktivna');
    }

    // Ako je ovo trenutna sinhronizacija, postavi flag i očisti ID
    if (this.currentSyncId === syncId) {
      this.shouldStop = true;
      this.currentSyncId = null;
      this.isRunning = false;
      this.logger.log(`🛑 Zaustavljam trenutnu sinhronizaciju ID: ${syncId}`);
    }

    // Ažuriraj status u bazi
    await this.prisma.gpsSyncLog.update({
      where: { id: syncId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
        error: 'Ručno zaustavljena sinhronizacija',
      },
    });

    return {
      success: true,
      message: `Sinhronizacija #${syncId} je zaustavljena`,
    };
  }

  async getCurrentStatus() {
    // Prvo počisti stare nezavršene sinhronizacije
    await this.cleanupStaleSyncs();
    
    const syncLog = this.currentSyncId 
      ? await this.prisma.gpsSyncLog.findUnique({
          where: { id: this.currentSyncId },
          include: { user: true },
        })
      : null;

    return {
      isRunning: this.isRunning,
      syncLog,
    };
  }
  
  private async cleanupStaleSyncs() {
    // Pronađi sve sinhronizacije koje su u statusu 'in_progress' 
    // ali su starije od 30 minuta (verovatno su prekinute)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const staleSyncs = await this.prisma.gpsSyncLog.updateMany({
      where: {
        status: 'in_progress',
        startedAt: {
          lt: thirtyMinutesAgo,
        },
      },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: 'Sinhronizacija prekinuta - timeout',
      },
    });
    
    if (staleSyncs.count > 0) {
      this.logger.log(`Očišćeno ${staleSyncs.count} starih nezavršenih sinhronizacija`);
    }
  }

  async cleanupAllStale() {
    // Očisti sve stare sinhronizacije, čak i one od pre 5 minuta
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const staleSyncs = await this.prisma.gpsSyncLog.updateMany({
      where: {
        status: 'in_progress',
        startedAt: {
          lt: fiveMinutesAgo,
        },
        // Isključi trenutnu aktivnu sinhronizaciju
        NOT: {
          id: this.currentSyncId || 0,
        },
      },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: 'Sinhronizacija prekinuta - ručno čišćenje',
      },
    });
    
    return {
      success: true,
      message: `Očišćeno ${staleSyncs.count} starih nezavršenih sinhronizacija`,
      cleaned: staleSyncs.count,
    };
  }

  async getSyncHistory(limit: number = 20) {
    return this.prisma.gpsSyncLog.findMany({
      take: limit,
      orderBy: { startedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async getSyncDetails(id: number, page: number, limit: number) {
    const syncLog = await this.prisma.gpsSyncLog.findUnique({
      where: { id },
      include: { user: true },
    });

    return {
      syncLog,
      page,
      limit,
    };
  }

  private async performSync(syncId: number, params: SyncParams) {
    let mysqlConnection: mysql.Connection | null = null;
    
    try {
      // Dohvati kredencijale za legacy bazu
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: {
          subtype: 'city_gps_ticketing_database',
          isActive: true,
        },
      });

      if (!legacyDb) {
        throw new Error('GPS legacy baza nije konfigurisana');
      }

      const password = this.decryptPassword(legacyDb.password);
      
      // Konektuj se na legacy MySQL bazu
      mysqlConnection = await mysql.createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: password,
        database: legacyDb.database,
        connectTimeout: 30000,
      });

      // Konektuj se na TimescaleDB koristeći centralizovan config
      this.pgPool = createTimescalePool();

      // Određi koja vozila treba sinhronizovati - sada koristimo vehicle IDs
      let vehicles;
      if (params.vehicleIds && params.vehicleIds.length > 0) {
        // Sinhronizuj specifičnu listu vozila po ID-evima
        vehicles = await this.prisma.busVehicle.findMany({
          where: { 
            id: { 
              in: params.vehicleIds 
            } 
          },
          select: { id: true, garageNumber: true },
        });
        if (vehicles.length === 0) {
          throw new Error(`Nijedno vozilo nije pronađeno sa zadatim ID-evima`);
        }
        this.logger.log(`📋 Pronađeno ${vehicles.length} od ${params.vehicleIds.length} traženih vozila`);
        this.logger.log(`📋 Lista vozila za sinhronizaciju: ${vehicles.map(v => `${v.garageNumber} (ID:${v.id})`).join(', ')}`);
      } else if (params.vehicleId) {
        // Sinhronizuj jedno vozilo po ID-u
        const vehicle = await this.prisma.busVehicle.findUnique({
          where: { id: params.vehicleId },
          select: { id: true, garageNumber: true },
        });
        if (!vehicle) {
          throw new Error(`Vozilo sa ID ${params.vehicleId} nije pronađeno`);
        }
        vehicles = [vehicle];
      } else {
        // Sinhronizuj sva vozila
        vehicles = await this.prisma.busVehicle.findMany({
          select: { id: true, garageNumber: true },
        });
        this.logger.log(`🚗 Sinhronizacija svih ${vehicles.length} vozila`);
      }

      let totalProcessed = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      let totalDistance = 0;

      // Za svako vozilo
      for (const vehicle of vehicles) {
        this.logger.log(`🔍 Provera pre vozila ${vehicle.garageNumber}: shouldStop=${this.shouldStop}, currentSyncId=${this.currentSyncId}`);
        
        // Proveri status iz baze pre svakog vozila
        const currentSync = await this.prisma.gpsSyncLog.findUnique({
          where: { id: syncId },
          select: { status: true },
        });
        
        this.logger.log(`🔍 Status iz baze: ${currentSync?.status}`);
        
        if (this.shouldStop || currentSync?.status === 'cancelled') {
          this.logger.log(`⛔ PREKIDAM! shouldStop=${this.shouldStop}, status=${currentSync?.status}`);
          this.shouldStop = true;
          break;
        }

        const garageNo = vehicle.garageNumber;
        this.logger.log(`Sinhronizacija GPS podataka za vozilo ${garageNo}`);

        try {
          // Loguj SQL upit koji će se izvršiti
          this.logger.log(`📋 SQL upit za vozilo ${garageNo}:`, {
            table: `${garageNo}gps`,
            startDate: params.startDate,
            endDate: params.endDate,
            startDateLocal: new Date(params.startDate).toLocaleString('sr-RS'),
            endDateLocal: new Date(params.endDate).toLocaleString('sr-RS'),
          });

          // Preuzmi podatke iz legacy baze
          const [rows] = await mysqlConnection.execute(`
            SELECT 
              '${garageNo}' as garageNo,
              lat,
              lng,
              speed,
              course,
              alt,
              state,
              inroute,
              captured,
              edited
            FROM \`${garageNo}gps\`
            WHERE captured BETWEEN ? AND ?
              AND lat IS NOT NULL
              AND lng IS NOT NULL
            ORDER BY captured ASC
          `, [params.startDate, params.endDate]);

          const gpsData = rows as any[];
          
          this.logger.log(`✅ Vozilo ${garageNo}: pronađeno ${gpsData.length} GPS tačaka`);
          this.logger.log(`   Period: ${new Date(params.startDate).toLocaleDateString('sr-RS')} - ${new Date(params.endDate).toLocaleDateString('sr-RS')}`);
          
          // Ažuriraj ukupan broj tačaka
          await this.prisma.gpsSyncLog.update({
            where: { id: syncId },
            data: {
              totalPoints: { increment: gpsData.length },
            },
          });

          // Obradi podatke u batch-ovima
          for (let i = 0; i < gpsData.length; i += params.batchSize) {
            // Proveri status iz baze pre svakog batch-a
            const currentSync = await this.prisma.gpsSyncLog.findUnique({
              where: { id: syncId },
              select: { status: true },
            });
            
            if (this.shouldStop || currentSync?.status === 'cancelled') {
              this.logger.log(`⛔ PREKIDAM BATCH! shouldStop=${this.shouldStop}, status=${currentSync?.status}, batch ${i}/${gpsData.length}`);
              this.shouldStop = true;
              break;
            }

            const batch = gpsData.slice(i, i + params.batchSize);
            
            // Batch INSERT - mnogo brže od pojedinačnih INSERT-a
            try {
              if (batch.length === 0) continue;
              
              // Generiši VALUES deo SQL upita
              const values: string[] = [];
              const queryParams: any[] = [];
              let paramIndex = 1;
              
              for (const point of batch) {
                const valueStr = `($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, ` +
                               `ST_SetSRID(ST_MakePoint($${paramIndex+5}, $${paramIndex+6}), 4326), ` +
                               `$${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}, $${paramIndex+11}, $${paramIndex+12})`;
                values.push(valueStr);
                
                queryParams.push(
                  new Date(point.captured),
                  vehicle.id,  // čuvamo vehicle_id za JOIN operacije, ali nije primarni ključ
                  point.garageNo,
                  parseFloat(point.lat),
                  parseFloat(point.lng),
                  parseFloat(point.lng),  // lng za ST_MakePoint
                  parseFloat(point.lat),   // lat za ST_MakePoint
                  point.speed || 0,
                  point.course || 0,
                  point.alt || 0,
                  point.state || 0,
                  Boolean(point.inroute),  // Konvertuj u boolean
                  'gps_sync'
                );
                
                paramIndex += 13;
              }
              
              const query = `
                INSERT INTO gps_data (
                  time, vehicle_id, garage_no, lat, lng, location,
                  speed, course, alt, state, in_route, data_source
                ) VALUES ${values.join(', ')}
                ON CONFLICT (vehicle_id, time) DO UPDATE SET
                  garage_no = EXCLUDED.garage_no,  -- ažuriraj garage_no ako se promenio
                  lat = EXCLUDED.lat,
                  lng = EXCLUDED.lng,
                  location = EXCLUDED.location,
                  speed = EXCLUDED.speed
                RETURNING (xmax = 0) as is_inserted
              `;
              
              const result = await this.pgPool.query(query, queryParams);
              
              // Brojanje inserted/updated
              for (const row of result.rows) {
                if (row.is_inserted) {
                  totalInserted++;
                } else {
                  totalUpdated++;
                }
                totalProcessed++;
              }
              
            } catch (error) {
              this.logger.error(`Greška pri batch unosu GPS tačaka:`, error);
              this.logger.error(`Error detalji: ${error.message}`);
              if (error.code) {
                this.logger.error(`Error code: ${error.code}`);
              }
              totalErrors += batch.length;
            }

            // Ažuriraj progres
            await this.prisma.gpsSyncLog.update({
              where: { id: syncId },
              data: {
                processedPoints: totalProcessed,
                insertedPoints: totalInserted,
                updatedPoints: totalUpdated,
                errorPoints: totalErrors,
              },
            });

            // Ako je prekinuto, izađi iz petlje
            if (this.shouldStop) {
              this.logger.log('⛔ Prekidam obradu vozila zbog zaustavljanja');
              break;
            }
            
            // Pauza između batch-ova
            if (i + params.batchSize < gpsData.length) {
              await this.sleep(params.delay);
              // Proveri ponovo nakon pauze
              if (this.shouldStop) {
                this.logger.log('⛔ Prekidam nakon pauze');
                break;
              }
            }
          }

          // Kalkuliši kilometražu za vozilo
          if (gpsData.length > 0) {
            const distanceResult = await this.pgPool.query(`
              WITH ordered_points AS (
                SELECT 
                  time,
                  location,
                  LAG(location) OVER (ORDER BY time) as prev_location
                FROM gps_data
                WHERE garage_no = $1
                  AND time BETWEEN $2 AND $3
                ORDER BY time
              )
              SELECT 
                SUM(
                  ST_Distance(
                    prev_location::geography,
                    location::geography
                  )
                ) / 1000.0 as total_km
              FROM ordered_points
              WHERE prev_location IS NOT NULL
            `, [garageNo, params.startDate, params.endDate]);

            const vehicleDistance = parseFloat(distanceResult.rows[0]?.total_km || 0);
            totalDistance += vehicleDistance;

            // Detektuj agresivnu vožnju za vozilo
            try {
              this.logger.log(`🔍 Detekcija agresivne vožnje za vozilo ${garageNo}...`);
              
              const detectionResult = await this.pgPool.query(`
                SELECT * FROM detect_aggressive_driving_batch(
                  $1::INTEGER,
                  $2::VARCHAR,
                  $3::TIMESTAMPTZ,
                  $4::TIMESTAMPTZ
                )
              `, [
                vehicle.id,
                garageNo,
                params.startDate,
                params.endDate
              ]);

              const detectionStats = detectionResult.rows[0];
              if (detectionStats) {
                this.logger.log(`✅ Detektovano za ${garageNo}:`);
                this.logger.log(`   - Ukupno događaja: ${detectionStats.total_events}`);
                this.logger.log(`   - Agresivna ubrzanja: ${detectionStats.acceleration_events}`);
                this.logger.log(`   - Agresivna kočenja: ${detectionStats.braking_events}`);
                this.logger.log(`   - Ozbiljni događaji: ${detectionStats.severe_events}`);
              }
            } catch (detectError) {
              this.logger.error(`Greška pri detekciji agresivne vožnje za ${garageNo}: ${detectError.message}`);
            }
          }

        } catch (error) {
          this.logger.error(`Greška pri sinhronizaciji vozila ${garageNo}: ${error.message}`);
        }
      }

      // KRITIČNO: Refresh continuous aggregates nakon uvoza podataka
      // Ovo je potrebno za brzo generisanje Monthly Report-a (20x brže)
      if (totalInserted > 0 || totalUpdated > 0) {
        try {
          this.logger.log('🔄 Osvežavam continuous aggregates za brže izveštaje...');
          
          // Refresh vehicle_hourly_stats za period sinhronizacije
          const refreshHourlyResult = await this.pgPool.query(`
            CALL refresh_continuous_aggregate(
              'vehicle_hourly_stats',
              $1::TIMESTAMPTZ,
              $2::TIMESTAMPTZ
            )
          `, [params.startDate, params.endDate]);
          
          this.logger.log('✅ vehicle_hourly_stats osvežen');
          
          // Refresh daily_vehicle_stats za period sinhronizacije
          const refreshDailyResult = await this.pgPool.query(`
            CALL refresh_continuous_aggregate(
              'daily_vehicle_stats', 
              $1::TIMESTAMPTZ,
              $2::TIMESTAMPTZ
            )
          `, [params.startDate, params.endDate]);
          
          this.logger.log('✅ daily_vehicle_stats osvežen');
          
          // Ažuriraj statistike za bolje performanse
          await this.pgPool.query('ANALYZE gps_data');
          await this.pgPool.query('ANALYZE driving_events');
          await this.pgPool.query('ANALYZE vehicle_hourly_stats');
          await this.pgPool.query('ANALYZE daily_vehicle_stats');
          
          this.logger.log('✅ Statistike ažurirane - Monthly Report će raditi optimalno!');
          
        } catch (refreshError) {
          this.logger.error('⚠️ Greška pri refresh agregata (nije kritično):', refreshError.message);
          // Nastavi dalje - ovo nije kritična greška
        }
      }

      // Finalno ažuriranje
      await this.prisma.gpsSyncLog.update({
        where: { id: syncId },
        data: {
          status: this.shouldStop ? 'cancelled' : 'completed',
          processedPoints: totalProcessed,
          insertedPoints: totalInserted,
          updatedPoints: totalUpdated,
          skippedPoints: totalSkipped,
          errorPoints: totalErrors,
          totalDistance,
          completedAt: new Date(),
        },
      });

      this.logger.log(`📊 GPS sinhronizacija završena za ${vehicles.length} vozila`);
      this.logger.log(`   Ukupno obrađeno: ${totalProcessed} tačaka`);
      this.logger.log(`   Novo ubačeno: ${totalInserted}`);
      this.logger.log(`   Ažurirano: ${totalUpdated}`);
      this.logger.log(`   Greške: ${totalErrors}`);
      this.logger.log(`   Ukupna kilometraža: ${totalDistance.toFixed(2)} km`);

    } catch (error) {
      this.logger.error('Greška u GPS sinhronizaciji:', error);
      await this.updateSyncStatus(syncId, 'failed', error.message);
      throw error;
    } finally {
      if (mysqlConnection) {
        await mysqlConnection.end();
      }
      if (this.pgPool) {
        await this.pgPool.end();
        this.pgPool = null;
      }
    }
  }

  private async updateSyncStatus(syncId: number, status: string, error?: string) {
    await this.prisma.gpsSyncLog.update({
      where: { id: syncId },
      data: {
        status,
        completedAt: new Date(),
        error,
      },
    });
  }

  private decryptPassword(encryptedPassword: string): string {
    try {
      const parts = encryptedPassword.split(':');
      if (parts.length !== 2) {
        return encryptedPassword;
      }
      
      const algorithm = 'aes-256-cbc';
      const keySource = process.env.DATABASE_ENCRYPTION_KEY || 'default-key-for-dev-only';
      const key = crypto.scryptSync(keySource, 'salt', 32);
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      this.logger.warn('Dekriptovanje nije uspelo, koristi se plain text');
      return encryptedPassword;
    }
  }

  private async sleep(ms: number): Promise<void> {
    const checkInterval = 100; // Proveri svakih 100ms
    const iterations = Math.ceil(ms / checkInterval);
    
    for (let i = 0; i < iterations; i++) {
      // Ako je sync zaustavljen, prekini odmah
      if (this.shouldStop) {
        this.logger.log('⏸️ Sleep prekinut zbog zaustavljanja');
        return;
      }
      
      // Proveri status u bazi
      if (this.currentSyncId) {
        const syncStatus = await this.prisma.gpsSyncLog.findUnique({
          where: { id: this.currentSyncId },
          select: { status: true },
        });
        
        if (syncStatus?.status === 'cancelled') {
          this.shouldStop = true;
          this.logger.log('⏸️ Sleep prekinut - status cancelled u bazi');
          return;
        }
      }
      
      // Čekaj kratak interval
      const waitTime = Math.min(checkInterval, ms - (i * checkInterval));
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}