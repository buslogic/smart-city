import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { createConnection, Connection } from 'mysql2/promise';
import { Prisma } from '@prisma/client';

@Injectable()
export class VehicleSyncService {
  // Konfiguracija
  private readonly BATCH_SIZE = 5; // Smanjeno za debugging
  private readonly DELAY_BETWEEN_BATCHES = 1000; // 1 sekunda
  private currentSyncLogId: number | null = null;
  private isRunning = false;
  private shouldStop = false;

  constructor(
    private prisma: PrismaService,
    private legacyDatabasesService: LegacyDatabasesService,
    private vehiclesService: VehiclesService,
  ) {}

  // Pokreni sinhronizaciju
  async startSync(
    userId: number, 
    syncType: 'full' | 'incremental' = 'full',
    config?: { batchSize?: number; delay?: number }
  ) {
    if (this.isRunning) {
      throw new BadRequestException('Sinhronizacija je već u toku');
    }

    // Pronađi mapping za bus_vehicles
    const mapping = await this.prisma.legacyTableMapping.findFirst({
      where: {
        localTableName: 'bus_vehicles',
        syncEnabled: true,
      },
      include: {
        legacyDatabase: true,
      },
    });

    if (!mapping) {
      // Proveri da li postoji mapiranje ali je sync_enabled = false
      const disabledMapping = await this.prisma.legacyTableMapping.findFirst({
        where: {
          localTableName: 'bus_vehicles',
          syncEnabled: false,
        },
        include: {
          legacyDatabase: true,
        },
      });

      if (disabledMapping) {
        throw new BadRequestException(
          '⚠️ VAŽNO: Sinhronizacija je onemogućena!\n\n' +
          'Mapiranje za bus_vehicles tabelu postoji ali opcija "Omogući sinhronizaciju" NIJE OZNAČENA.\n\n' +
          '✅ Rešenje:\n' +
          '1. Idite na Podešavanja > Legacy baze\n' +
          '2. Pronađite mapiranje za bus_vehicles tabelu\n' +
          '3. OZNAČITE checkbox "Omogući sinhronizaciju"\n' +
          '4. Sačuvajte izmene\n' +
          '5. Pokušajte ponovo sinhronizaciju'
        );
      }

      throw new NotFoundException(
        'Mapiranje za bus_vehicles tabelu nije konfigurisano. ' +
        'Molim idite na Podešavanja > Legacy baze i konfiguršite mapiranje tabele pre pokretanja sinhronizacije.'
      );
    }

    // Kreiraj sync log
    const syncLog = await this.prisma.vehicleSyncLog.create({
      data: {
        syncType,
        status: 'pending',
        startedAt: new Date(),
        totalRecords: 0,
        userId,
      },
    });

    this.currentSyncLogId = syncLog.id;
    this.isRunning = true;
    this.shouldStop = false;

    // Pokreni sync u pozadini
    this.processSyncJob(syncLog.id, mapping.legacyDatabase, config).catch(error => {
      console.error('Sync job error:', error);
      this.updateSyncStatus(syncLog.id, 'failed', error.message);
    }).finally(() => {
      this.isRunning = false;
      this.currentSyncLogId = null;
    });

    return {
      syncLogId: syncLog.id,
      message: 'Sinhronizacija je pokrenuta',
    };
  }

  // Zaustavi sinhronizaciju
  async stopSync() {
    if (!this.isRunning) {
      throw new BadRequestException('Nema aktivne sinhronizacije');
    }

    this.shouldStop = true;
    
    if (this.currentSyncLogId) {
      await this.updateSyncStatus(this.currentSyncLogId, 'cancelled');
    }

    return { message: 'Sinhronizacija će biti zaustavljena' };
  }

  // Procesiraj sync job
  private async processSyncJob(
    syncLogId: number, 
    legacyDb: any, 
    config?: { batchSize?: number; delay?: number }
  ) {
    let connection: Connection | null = null;

    // Koristi prosleđene parametre ili default vrednosti
    const batchSize = config?.batchSize || this.BATCH_SIZE;
    const delay = config?.delay || this.DELAY_BETWEEN_BATCHES;

    try {
      // Update status na in_progress
      await this.updateSyncStatus(syncLogId, 'in_progress');

      // Konektuj se na legacy bazu
      const password = this.legacyDatabasesService.decryptPassword(legacyDb.password);
      
      connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: password,
        database: legacyDb.database,
      });

      // Prebaci ukupan broj vozila
      const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM bus_vehicle');
      const totalRecords = (countResult as any)[0].total;

      await this.prisma.vehicleSyncLog.update({
        where: { id: syncLogId },
        data: { totalRecords },
      });

      // Procesiraj u batch-ovima
      let offset = 0;
      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      while (offset < totalRecords && !this.shouldStop) {
        // Učitaj batch vozila iz legacy baze
        const [vehicles] = await connection.execute(
          `SELECT * FROM bus_vehicle LIMIT ${batchSize} OFFSET ${offset}`
        );

        // Procesiraj batch
        for (const legacyVehicle of vehicles as any[]) {
          if (this.shouldStop) break;

          try {
            const result = await this.processVehicle(syncLogId, legacyVehicle);
            
            switch (result.action) {
              case 'create':
                createdCount++;
                break;
              case 'update':
                updatedCount++;
                break;
              case 'skip':
                skippedCount++;
                break;
            }
          } catch (error) {
            errorCount++;
            const vehicleId = legacyVehicle.ID || legacyVehicle.id || legacyVehicle.BusVehicleID || 0;
            
            
            // Skrati error poruku na max 255 karaktera
            const errorMsg = error.message ? error.message.substring(0, 255) : 'Unknown error';
            await this.logSyncDetail(syncLogId, vehicleId, 'error', null, errorMsg);
          }
        }

        // Update progress
        const processedRecords = offset + (vehicles as any[]).length;
        await this.prisma.vehicleSyncLog.update({
          where: { id: syncLogId },
          data: {
            processedRecords,
            createdRecords: createdCount,
            updatedRecords: updatedCount,
            skippedRecords: skippedCount,
            errorRecords: errorCount,
          },
        });

        offset += batchSize;

        // Pauza između batch-ova
        if (offset < totalRecords && !this.shouldStop) {
          await this.delay(delay);
        }
      }

      // Završi sync
      const finalStatus = this.shouldStop ? 'cancelled' : 'completed';
      await this.updateSyncStatus(syncLogId, finalStatus);

    } catch (error) {
      await this.updateSyncStatus(syncLogId, 'failed', error.message);
      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
      this.isRunning = false;
      this.currentSyncLogId = null;
    }
  }

  // Procesiraj pojedinačno vozilo
  private async processVehicle(syncLogId: number, legacyVehicle: any) {
    // Pronađi ID polje - može biti ID, id, ili BusVehicleID
    const legacyId = legacyVehicle.ID || legacyVehicle.id || legacyVehicle.BusVehicleID;
    
    if (!legacyId) {
      throw new Error('Legacy vehicle has no ID field');
    }
    
    // Proveri da li vozilo već postoji
    const existingVehicle = await this.prisma.busVehicle.findUnique({
      where: { legacyId: legacyId },
    });

    // Mapiraj podatke iz legacy formata
    const vehicleData = this.mapLegacyVehicle(legacyVehicle);

    if (!existingVehicle) {
      // Kreiraj novo vozilo
      try {
        const newVehicle = await this.prisma.busVehicle.create({
          data: {
            ...vehicleData,
            legacyId: legacyId,
            lastSyncAt: new Date(),
          },
        });

        await this.logSyncDetail(syncLogId, legacyId, 'create');
        return { action: 'create', vehicle: newVehicle };
      } catch (error) {
        throw error;
      }
    } else {
      // Proveri da li ima promena
      const changes = this.detectChanges(existingVehicle, vehicleData);
      
      if (Object.keys(changes).length > 0) {
        // Update postojeće vozilo
        try {
          const updatedVehicle = await this.prisma.busVehicle.update({
            where: { id: existingVehicle.id },
            data: {
              ...vehicleData,
              lastSyncAt: new Date(),
            },
          });

          await this.logSyncDetail(syncLogId, legacyId, 'update', changes);
          return { action: 'update', vehicle: updatedVehicle };
        } catch (error) {
          throw error;
        }
      } else {
        // Nema promena
        await this.logSyncDetail(syncLogId, legacyId, 'skip');
        return { action: 'skip', vehicle: existingVehicle };
      }
    }
  }

  // Helper funkcija za validaciju datuma
  private parseValidDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    
    const date = new Date(dateValue);
    
    // Proveri da li je datum validan
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // Proveri da li je u razumnom opsegu (1900-2100)
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
      return null;
    }
    
    return date;
  }

  // Mapiraj legacy vozilo u naš format
  private mapLegacyVehicle(legacy: any) {
    // Generiši jedinstveni garageNumber koristeći ID ako je garage_no prazan
    const garageNo = legacy.garage_no || legacy.garazni_broj;
    const uniqueGarageNumber = garageNo || `AUTO_${legacy.id}`;
    
    return {
      garageNumber: uniqueGarageNumber,
      registrationNumber: legacy.bus_registration || legacy.registracijski_broj || null,
      vehicleNumber: legacy.vehicle_number || null,
      vehicleType: legacy.vehicle_type || legacy.tip || null,
      vehicleBrand: legacy.vehicle_brand || null,
      vehicleModel: legacy.vehicle_model || legacy.model_vozila || null,
      chassisNumber: legacy.chassis_number || null,
      motorNumber: legacy.motor_number || null,
      yearOfManufacture: this.parseValidDate(legacy.godina_proizvodnje),
      seatCapacity: parseInt(legacy.broj_sedecih) || 0,
      standingCapacity: parseInt(legacy.broj_stajacih) || 0,
      totalCapacity: (parseInt(legacy.broj_sedecih) || 0) + (parseInt(legacy.broj_stajacih) || 0),
      fuelType: legacy.fuel_type || null,
      active: legacy.active === 1, // 1 = aktivno, 0 = neaktivno
      visible: legacy.show_image_in_public === 1,
      wifi: legacy.wifi === 1,
      airCondition: legacy.aircondition === 1,
      rampForDisabled: false, // Nema u legacy bazi
      videoSystem: legacy.surveliance_camera === 1,
      lowFloor: false, // Nema u legacy bazi
      imei: legacy.imei || null,
      imeiNet: legacy.imei_net || null,
      gpsModel: legacy.gps_model || null,
      technicalControlFrom: this.parseValidDate(legacy.tech_control_from),
      technicalControlTo: this.parseValidDate(legacy.tech_control_to),
      registrationValidTo: this.parseValidDate(legacy.validate_to),
      firstRegistrationDate: this.parseValidDate(legacy.first_registration_date),
      centralPointId: parseInt(legacy.central_point_db_id) || null,
      centralPointName: legacy.central_point_name || null,
      note: legacy.note || legacy.napomena_vozilo || null,
    };
  }

  // Detektuj promene
  private detectChanges(existing: any, newData: any) {
    const changes: any = {};

    for (const key in newData) {
      // Poredi vrednosti
      const existingValue = existing[key];
      const newValue = newData[key];

      // Posebno tretiranje datuma
      if (existingValue instanceof Date && newValue instanceof Date) {
        if (existingValue.getTime() !== newValue.getTime()) {
          changes[key] = { old: existingValue, new: newValue };
        }
      } else if (existingValue !== newValue) {
        changes[key] = { old: existingValue, new: newValue };
      }
    }

    return changes;
  }

  // Loguj sync detalj
  private async logSyncDetail(
    syncLogId: number,
    legacyId: number,
    action: string,
    changes: any = null,
    errorMessage: string | null = null
  ) {
    await this.prisma.vehicleSyncDetail.create({
      data: {
        syncLogId,
        legacyId,
        action,
        changes: changes ? changes : Prisma.JsonNull,
        errorMessage,
      },
    });
  }

  // Update sync status
  private async updateSyncStatus(syncLogId: number, status: string, errorMessage?: string) {
    const updateData: any = { status };
    
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updateData.completedAt = new Date();
    }

    if (errorMessage) {
      updateData.errorDetails = { message: errorMessage };
    }

    await this.prisma.vehicleSyncLog.update({
      where: { id: syncLogId },
      data: updateData,
    });
  }

  // Delay helper
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Dobavi trenutni status
  async getCurrentStatus() {
    if (!this.currentSyncLogId) {
      return { isRunning: false };
    }

    const syncLog = await this.prisma.vehicleSyncLog.findUnique({
      where: { id: this.currentSyncLogId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return {
      isRunning: this.isRunning,
      syncLog,
    };
  }

  // Dobavi istoriju sinhronizacija
  async getSyncHistory(limit: number = 10) {
    return this.prisma.vehicleSyncLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  // Dobavi detalje sync-a
  async getSyncDetails(syncLogId: number, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [details, total] = await Promise.all([
      this.prisma.vehicleSyncDetail.findMany({
        where: { syncLogId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vehicleSyncDetail.count({
        where: { syncLogId },
      }),
    ]);

    return {
      data: details,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
