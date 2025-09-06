import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Client } from 'pg';

const execAsync = promisify(exec);

// Worker Pool konfiguracija
interface WorkerPoolConfig {
  maxWorkers: number;
  workerTimeout: number;
  retryAttempts: number;
  resourceLimits?: {
    maxMemoryMB?: number;
    maxCpuPercent?: number;
  };
}

// Worker rezultat
export interface WorkerResult {
  workerId: number;
  vehicleId: number;
  garageNumber: string;
  status: 'completed' | 'failed';
  processedRecords: number;
  totalRecords: number;
  startTime: Date;
  endTime: Date;
  duration: number;
  error?: string;
  logs: string[];
}

// Worker status
interface WorkerStatus {
  workerId: number;
  vehicleId?: number;
  garageNumber?: string;
  status: 'idle' | 'exporting' | 'transferring' | 'importing' | 'detecting' | 'refreshing' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  totalRecords?: number; // Ukupan broj GPS tačaka
  processedRecords?: number; // Trenutno obrađeno
  startTime?: Date;
}

@Injectable()
export class LegacySyncWorkerPoolService {
  private readonly logger = new Logger(LegacySyncWorkerPoolService.name);
  
  // Worker Pool konfiguracija
  private config: WorkerPoolConfig = {
    maxWorkers: 3,
    workerTimeout: 600000, // 10 minuta
    retryAttempts: 2,
    resourceLimits: {
      maxMemoryMB: 512,
      maxCpuPercent: 25
    }
  };
  
  // Worker statusi
  private workers: Map<number, WorkerStatus> = new Map();
  private activeWorkers = 0;
  
  // Legacy server konfiguracija
  private readonly LEGACY_HOST = process.env.LEGACY_SERVER_HOST || '79.101.48.11';
  private readonly SSH_KEY_PATH = process.env.LEGACY_SSH_KEY_PATH || '~/.ssh/hp-notebook-2025-buslogic';
  private readonly LEGACY_DB = 'pib100065430gps';
  
  constructor(private readonly prisma: PrismaService) {
    this.loadConfiguration();
  }
  
  /**
   * Učitava konfiguraciju iz SystemSettings
   */
  private async loadConfiguration() {
    try {
      const settings = await this.prisma.systemSettings.findMany({
        where: { category: 'legacy_sync' }
      });
      
      settings.forEach(setting => {
        const value = setting.type === 'number' ? parseInt(setting.value) : setting.value;
        
        switch(setting.key) {
          case 'legacy_sync.worker_pool.max_workers':
            this.config.maxWorkers = value as number;
            break;
          case 'legacy_sync.worker_pool.worker_timeout_ms':
            this.config.workerTimeout = value as number;
            break;
          case 'legacy_sync.worker_pool.retry_attempts':
            this.config.retryAttempts = value as number;
            break;
        }
      });
      
      this.logger.log(`✅ Worker Pool konfiguracija učitana: ${this.config.maxWorkers} worker-a`);
    } catch (error) {
      this.logger.warn('Koriste se default Worker Pool podešavanja');
    }
  }
  
  /**
   * GLAVNA METODA - Pokreće Worker Pool za sinhronizaciju
   */
  async startWorkerPoolSync(
    vehicleIds: number[],
    syncFrom: Date,
    syncTo: Date,
    jobId: string,
    refreshAggregates: boolean = false, // Opciono osvežavanje continuous aggregates
    keepCompletedStatuses: boolean = false // Za Smart Slow Sync - zadrži completed vozila iz prethodnog batch-a
  ): Promise<Map<number, WorkerResult>> {
    const startTime = Date.now();
    this.logger.log(`🚀 Pokrećem Worker Pool sa max ${this.config.maxWorkers} worker-a za ${vehicleIds.length} vozila`);
    
    // Resetuj worker statuse
    if (keepCompletedStatuses) {
      // Za Smart Slow Sync - zadrži completed statuse iz prethodnog batch-a
      const completedWorkers = new Map();
      for (const [workerId, worker] of this.workers) {
        if (worker.status === 'completed' || worker.status === 'failed') {
          completedWorkers.set(workerId, worker);
        }
      }
      this.workers.clear();
      // Vrati completed worker-e
      for (const [workerId, worker] of completedWorkers) {
        this.workers.set(workerId, worker);
      }
    } else {
      this.workers.clear();
    }
    this.activeWorkers = 0;
    
    // Dobavi informacije o vozilima
    const vehicles = await this.getVehicleInfo(vehicleIds);
    
    // Podeli vozila na chunk-ove prema broju worker-a
    const workerCount = Math.min(this.config.maxWorkers, vehicles.length);
    const vehicleChunks = this.splitIntoChunks(vehicles, workerCount);
    
    // Kreiraj promise za svaki worker
    const workerPromises: Promise<WorkerResult[]>[] = [];
    
    for (let i = 0; i < vehicleChunks.length; i++) {
      const workerId = i + 1;
      const vehicleChunk = vehicleChunks[i];
      
        // Kreiraj worker status sa workerId kao ključ
      if (!this.workers.has(workerId)) {
        this.workers.set(workerId, {
          workerId: workerId,
          vehicleId: undefined, // Postaviće se u runWorker
          garageNumber: undefined, // Postaviće se u runWorker
          status: 'idle',
          progress: 0,
          startTime: new Date()
        });
      }
      
      // Pokreni worker
      workerPromises.push(
        this.runWorker(workerId, vehicleChunk, syncFrom, syncTo, jobId)
      );
    }
    
    // Čekaj da svi worker-i završe
    const workerResults = await Promise.allSettled(workerPromises);
    
    // Agregiraj rezultate
    const allResults = new Map<number, WorkerResult>();
    let totalProcessed = 0;
    let totalFailed = 0;
    
    workerResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        result.value.forEach(vehicleResult => {
          allResults.set(vehicleResult.vehicleId, vehicleResult);
          if (vehicleResult.status === 'completed') {
            totalProcessed += vehicleResult.processedRecords;
          } else {
            totalFailed++;
          }
        });
      } else {
        this.logger.error(`Worker ${index + 1} je pao: ${result.reason}`);
        totalFailed += vehicleChunks[index].length;
      }
    });
    
    const totalTime = Date.now() - startTime;
    this.logger.log(
      `✅ Worker Pool završen: ${totalProcessed} GPS tačaka procesirano, ` +
      `${totalFailed} vozila failed za ${(totalTime / 1000).toFixed(1)}s`
    );
    
    // Opciono: Osvježi continuous aggregates ako je zatraženo
    if (refreshAggregates && totalProcessed > 0) {
      try {
        this.logger.log('🔄 Osvežavam continuous aggregates (opcija je uključena)...');
        
        // Pronađi vremenski opseg za refresh
        const minDate = new Date(syncFrom);
        const maxDate = new Date(syncTo);
        
        // Osvježi sve tri continuous aggregate tabele
        const aggregatesToRefresh = [
          'vehicle_hourly_stats',
          'daily_vehicle_stats', 
          'monthly_vehicle_raw_stats'
        ];
        
        // Koristi direktnu PostgreSQL konekciju za TimescaleDB operacije
        const { Pool } = require('pg');
        const pgPool = new Pool({
          connectionString: process.env.TIMESCALE_DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        let successCount = 0;
        for (const aggregateName of aggregatesToRefresh) {
          try {
            // Ažuriraj status svih worker-a
            this.workers.forEach(worker => {
              worker.status = 'refreshing';
              worker.currentStep = `Osvežavam ${aggregateName}`;
              worker.progress = 90 + (successCount * 3); // 90-99%
            });
            
            // Direktno pozovi refresh_continuous_aggregate na TimescaleDB
            // Eksplicitno kastuj datume u timestamptz
            await pgPool.query(
              `CALL refresh_continuous_aggregate($1, $2::timestamptz, $3::timestamptz)`,
              [aggregateName, minDate.toISOString(), maxDate.toISOString()]
            );
            
            this.logger.log(`  ✅ ${aggregateName} osvežen`);
            successCount++;
            
            // Ažuriraj progress
            this.workers.forEach(worker => {
              worker.progress = 90 + (successCount * 3); // 93, 96, 99%
            });
          } catch (error) {
            this.logger.warn(`  ⚠️ Ne mogu osvežiti ${aggregateName}: ${error.message}`);
          }
        }
        
        await pgPool.end();
        
        // Označii završetak refresh-a
        this.workers.forEach(worker => {
          worker.status = 'completed';
          worker.progress = 100;
          worker.currentStep = successCount > 0 
            ? `Završeno: ${successCount} agregata osveženo` 
            : 'Završeno (aggregates se osvežavaju automatski)';
        });
        
        if (successCount > 0) {
          this.logger.log(`📊 Osveženo ${successCount}/${aggregatesToRefresh.length} agregata - izveštaji su ažurirani!`);
        } else {
          this.logger.warn('⚠️ Nije moguće osvežiti aggregate - izveštaji će biti ažurirani automatski za 1 sat');
        }
      } catch (error) {
        this.logger.error(`Greška pri osvežavanju continuous aggregates: ${error.message}`);
        // Ne prekidaj proces zbog greške u refresh-u
      }
    } else if (!refreshAggregates && totalProcessed > 0) {
      // Aggregates će se automatski osvežiti za 1 sat
      // Označii završetak bez refresh-a
      this.workers.forEach(worker => {
        if (worker.status !== 'failed') {
          worker.status = 'completed';
          worker.progress = 100;
          worker.currentStep = 'Završeno (aggregates se osvežavaju automatski za 1h)';
        }
      });
    }
    
    return allResults;
  }
  
  /**
   * Pokreće pojedinačni worker
   */
  private async runWorker(
    workerId: number,
    vehicles: any[],
    syncFrom: Date,
    syncTo: Date,
    jobId: string
  ): Promise<WorkerResult[]> {
    const results: WorkerResult[] = [];
    this.activeWorkers++;
    
    // this.logger.debug(`Worker ${workerId}: Počinje`);
    
    for (const vehicle of vehicles) {
      const workerStatus = this.workers.get(workerId)!;
      workerStatus.vehicleId = vehicle.id;
      workerStatus.garageNumber = vehicle.garage_number;
      workerStatus.status = 'exporting';
      
      const result = await this.syncVehicleWithWorker(
        workerId,
        vehicle,
        syncFrom,
        syncTo
      );
      
      results.push(result);
      
      // Ažuriraj worker status - koristi vehicleId kao ključ
      const finalWorkerStatus = this.workers.get(vehicle.id);
      if (finalWorkerStatus) {
        finalWorkerStatus.status = result.status === 'completed' ? 'completed' : 'failed';
        finalWorkerStatus.progress = 100;
        finalWorkerStatus.totalRecords = result.totalRecords;
        finalWorkerStatus.processedRecords = result.processedRecords;
      }
    }
    
    this.activeWorkers--;
    // this.logger.debug(`Worker ${workerId}: Završen`);
    
    return results;
  }
  
  /**
   * Sinhronizuje jedno vozilo (worker task)
   */
  private async syncVehicleWithWorker(
    workerId: number,
    vehicle: any,
    syncFrom: Date,
    syncTo: Date
  ): Promise<WorkerResult> {
    const startTime = new Date();
    const logs: string[] = [];
    const garageNo = vehicle.garage_number;
    const tableName = `${garageNo}gps`;
    
    // Ažuriraj worker status - koristi vehicleId kao ključ
    const updateWorkerStatus = (status: WorkerStatus['status'], step?: string, progress?: number) => {
      const workerStatus = this.workers.get(vehicle.id);
      if (workerStatus) {
        workerStatus.status = status;
        workerStatus.currentStep = step;
        if (progress !== undefined) workerStatus.progress = progress;
        // Ažuriraj dodatne informacije
        workerStatus.vehicleId = vehicle.id;
        workerStatus.garageNumber = vehicle.garage_number;
      }
    };
    
    try {
      logs.push(`[Worker ${workerId}] 🚗 Počinje sinhronizaciju za ${garageNo}`);
      
      // Step 1: COUNT zapisa
      updateWorkerStatus('exporting', 'Brojanje zapisa', 10);
      const fromDate = syncFrom.toISOString().split('T')[0];
      const toDate = syncTo.toISOString().split('T')[0];
      
      const countCmd = `ssh -i ${this.SSH_KEY_PATH} root@${this.LEGACY_HOST} "mysql -uroot ${this.LEGACY_DB} -e 'SELECT COUNT(*) as total FROM ${tableName} WHERE captured >= \\"${fromDate} 00:00:00\\" AND captured <= \\"${toDate} 23:59:59\\"'"`;
      
      const { stdout: countOutput } = await execAsync(countCmd);
      const totalMatch = countOutput.match(/(\d+)/);
      const totalRecords = totalMatch ? parseInt(totalMatch[1]) : 0;
      
      logs.push(`[Worker ${workerId}] 📊 Pronađeno ${totalRecords.toLocaleString()} GPS tačaka`);
      
      // Ažuriraj worker status sa brojem tačaka
      const workerStatus = this.workers.get(workerId)!;
      workerStatus.totalRecords = totalRecords;
      workerStatus.currentStep = `Pronađeno ${totalRecords.toLocaleString()} GPS tačaka`;
      
      if (totalRecords === 0) {
        logs.push(`[Worker ${workerId}] ⚠️ Nema podataka za period`);
        return {
          workerId,
          vehicleId: vehicle.id,
          garageNumber: garageNo,
          status: 'completed',
          processedRecords: 0,
          totalRecords: 0,
          startTime,
          endTime: new Date(),
          duration: Date.now() - startTime.getTime(),
          logs
        };
      }
      
      // Step 2: EXPORT podataka
      updateWorkerStatus('exporting', 'Export podataka', 30);
      const exportFileName = `${garageNo}_worker${workerId}_${Date.now()}.sql.gz`;
      // Koristi /tmp direktorijum koji uvek postoji
      const localPath = path.join('/tmp', exportFileName);
      
      const sshExportCmd = `ssh -i ${this.SSH_KEY_PATH} root@${this.LEGACY_HOST} "
        cd /tmp && 
        mysqldump -uroot ${this.LEGACY_DB} ${tableName} \\
          --where=\\"captured >= '${fromDate} 00:00:00' AND captured <= '${toDate} 23:59:59'\\" | \\
          gzip > ${exportFileName} &&
        ls -lh ${exportFileName}
      "`;
      
      await execAsync(sshExportCmd);
      logs.push(`[Worker ${workerId}] 💾 Export završen: ${exportFileName}`);
      
      // Step 3: TRANSFER fajla
      updateWorkerStatus('transferring', 'Transfer fajla', 50);
      const scpCmd = `scp -i ${this.SSH_KEY_PATH} root@${this.LEGACY_HOST}:/tmp/${exportFileName} ${localPath}`;
      await execAsync(scpCmd);
      logs.push(`[Worker ${workerId}] 📥 Transfer završen`);
      
      // Step 4: IMPORT u TimescaleDB
      updateWorkerStatus('importing', 'Import u bazu', 70);
      
      // Detektuj okruženje i koristi odgovarajuću metodu
      let importSuccess = false;
      let importedCount = 0;
      
      // Koristi Node.js import za oba okruženja (development i production)
      // executeProductionImport automatski koristi prave kredencijale iz .env fajla
      logs.push(`[Worker ${workerId}] 🔄 Izvršavam import direktno kroz Node.js...`);
      
      try {
        // Ova metoda koristi TIMESCALE_DATABASE_URL iz .env fajla
        // Development: postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps
        // Production: postgres://tsdbadmin:PASS@b96osgyp1w.duvl2ceai2.tsdb.cloud.timescale.com:31143/tsdb
        const result = await this.executeProductionImport(localPath, garageNo, vehicle.id);
        importSuccess = result.success;
        importedCount = result.count;
        
        if (importSuccess) {
          logs.push(`[Worker ${workerId}] ✅ Import uspešan: ${importedCount} GPS tačaka`);
          
          // Ažuriraj worker status sa obrađenim zapisima
          const workerStatus = this.workers.get(workerId)!;
          workerStatus.processedRecords = importedCount;
          workerStatus.currentStep = `Import završen: ${importedCount.toLocaleString()} GPS tačaka`;
        }
      } catch (error) {
        logs.push(`[Worker ${workerId}] ❌ Import greška: ${error.message}`);
      }
      
      if (!importSuccess) {
        throw new Error('Import neuspešan');
      }
      
      const processedRecords = importedCount;
      
      // Step 5: DETECT AGGRESSIVE DRIVING
      if (importSuccess && importedCount > 0) {
        updateWorkerStatus('detecting', 'Detekcija agresivne vožnje', 85);
        logs.push(`[Worker ${workerId}] 🔍 Pokrećem detekciju agresivne vožnje...`);
        
        try {
          const detectedEvents = await this.detectAggressiveDriving(vehicle.id, garageNo, syncFrom, syncTo);
          updateWorkerStatus('detecting', `Detektovano ${detectedEvents} agresivnih događaja`, 88);
          logs.push(`[Worker ${workerId}] ✅ Detekcija završena: ${detectedEvents} agresivnih događaja`);
        } catch (detectionError) {
          logs.push(`[Worker ${workerId}] ⚠️ Detekcija greška: ${detectionError.message}`);
          // Ne prekidaj proces zbog greške u detekciji
        }
      }
      
      // Step 6: CLEANUP
      updateWorkerStatus('completed', 'Čišćenje', 90);
      try {
        await execAsync(`rm -f ${localPath}`);
        await execAsync(`ssh -i ${this.SSH_KEY_PATH} root@${this.LEGACY_HOST} "rm -f /tmp/${exportFileName}"`);
        logs.push(`[Worker ${workerId}] 🧹 Privremeni fajlovi obrisani`);
      } catch (cleanupError) {
        logs.push(`[Worker ${workerId}] ⚠️ Cleanup greška: ${cleanupError.message}`);
      }
      
      updateWorkerStatus('completed', 'Završeno', 100);
      
      return {
        workerId,
        vehicleId: vehicle.id,
        garageNumber: garageNo,
        status: 'completed',
        processedRecords,
        totalRecords,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
        logs
      };
      
    } catch (error) {
      logs.push(`[Worker ${workerId}] ❌ Greška: ${error.message}`);
      updateWorkerStatus('failed', 'Greška', 0);
      
      return {
        workerId,
        vehicleId: vehicle.id,
        garageNumber: garageNo,
        status: 'failed',
        processedRecords: 0,
        totalRecords: 0,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
        error: error.message,
        logs
      };
    }
  }
  
  /**
   * Dobavlja informacije o vozilima
   */
  private async getVehicleInfo(vehicleIds: number[]): Promise<any[]> {
    const { Prisma } = await import('@prisma/client');
    return await this.prisma.$queryRaw`
      SELECT id, garage_number, legacy_id 
      FROM bus_vehicles 
      WHERE id IN (${Prisma.join(vehicleIds)})
    `;
  }
  
  /**
   * Deli niz na chunk-ove
   */
  private splitIntoChunks<T>(array: T[], chunkCount: number): T[][] {
    const chunks: T[][] = [];
    const chunkSize = Math.ceil(array.length / chunkCount);
    
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    
    return chunks;
  }
  
  /**
   * Vraća trenutni status svih worker-a
   */
  getWorkerStatuses(): WorkerStatus[] {
    return Array.from(this.workers.values());
  }
  
  /**
   * Vraća broj aktivnih worker-a
   */
  getActiveWorkerCount(): number {
    return this.activeWorkers;
  }
  
  /**
   * Prekida sve aktivne worker-e
   */
  async stopAllWorkers(): Promise<void> {
    this.logger.warn('⛔ Zaustavljanje svih worker-a...');
    // Implementacija za graceful shutdown
    this.workers.forEach(worker => {
      worker.status = 'failed';
      worker.currentStep = 'Prekinuto od strane korisnika';
    });
    this.activeWorkers = 0;
  }

  /**
   * Izvršava import na produkciji direktno kroz Node.js
   */
  private async executeProductionImport(
    dumpFilePath: string,
    garageNo: string,
    vehicleId: number
  ): Promise<{ success: boolean; count: number }> {
    // Debug logovi isključeni - previše zagušuju konzolu
    
    const { Pool } = require('pg');
    const fs = require('fs');
    const zlib = require('zlib');
    const readline = require('readline');
    
    // Proveri da li fajl postoji
    if (!fs.existsSync(dumpFilePath)) {
      this.logger.error(`Dump file not found: ${dumpFilePath}`);
      return { success: false, count: 0 };
    }
    
    const fileStats = fs.statSync(dumpFilePath);
    // this.logger.debug(`Dump file size: ${fileStats.size} bytes`);
    
    // Kreiraj konekciju ka TimescaleDB
    const pool = new Pool({
      connectionString: process.env.TIMESCALE_DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    let importedCount = 0;
    // Čitamo po 10,000 redova za efikasniju obradu fajla
    const READ_BATCH_SIZE = 10000;
    // Ali insertujemo po 2,500 da budemo ispod PostgreSQL limita (32,767 params)
    // 2,500 redova × 11 parametara = 27,500 parametara (bezbedno ispod limita)
    const INSERT_BATCH_SIZE = 2500;
    let batch: any[] = [];
    let lineCount = 0;

    try {
      // Test konekcije
      const testClient = await pool.connect();
      await testClient.query('SELECT 1');
      testClient.release();
      // this.logger.debug('TimescaleDB connection successful');
      // Čitaj i parsuj dump fajl
      const gunzip = zlib.createGunzip();
      const stream = fs.createReadStream(dumpFilePath).pipe(gunzip);
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        lineCount++;
        
        if (!line.startsWith('INSERT INTO')) continue;
        
        // Log prvih par INSERT linija za debug
        if (importedCount < 10) {
          this.logger.log(`Line ${lineCount}: ${line.substring(0, 200)}...`);
        }
        
        // Parsuj INSERT statement
        const valuesMatch = line.match(/VALUES\s*(.+);?$/);
        if (!valuesMatch) {
          this.logger.warn(`Could not parse VALUES from line ${lineCount}`);
          continue;
        }
        
        // Ekstraktuj values
        const valuesStr = valuesMatch[1];
        
        // Regex za parsiranje pojedinačnih redova iz VALUES
        // Matches: ('2025-08-28 22:00:27','2025-08-29 00:00:01',44.81432830,20.52106660,96,0,103,0,0)
        const rowRegex = /\(([^)]+)\)/g;
        let rowMatch;
        
        while ((rowMatch = rowRegex.exec(valuesStr)) !== null) {
          const rowContent = rowMatch[1];
          
          // Parsuj kolone korišćenjem regex-a da pravilno handle-uje string vrednosti sa quotes
          // Pattern: bilo koji string u quotes ili broj
          const valueRegex = /'([^']*)'|([^,]+)/g;
          const cols: string[] = [];
          let valueMatch;
          
          while ((valueMatch = valueRegex.exec(rowContent)) !== null) {
            // Ako je match u quotes (group 1), koristi ga, inače koristi group 2 (broj)
            cols.push(valueMatch[1] !== undefined ? valueMatch[1] : valueMatch[2].trim());
          }
          
          // Debug log za prvih par redova
          // Debug logovi isključeni
          // if (batch.length < 5) {
          //   this.logger.debug(`Parsed row ${batch.length}: ${cols.length} columns`);
          // }
          
          // Preskoci ako nema dovoljno kolona
          if (cols.length < 9) {
            // Skipping row with insufficient columns
            continue;
          }
          
          batch.push({
            time: cols[1], // captured timestamp
            vehicle_id: vehicleId,
            garage_no: garageNo,
            lat: parseFloat(cols[2]),
            lng: parseFloat(cols[3]),
            speed: parseFloat(cols[5]) || 0,
            course: parseFloat(cols[4]) || 0,
            alt: parseFloat(cols[6]) || 0,
            state: parseInt(cols[8]) || 0,
            in_route: parseInt(cols[7]) > 0
          });
          
          // Kada batch dostigne READ veličinu, podeli ga na manje INSERT batch-ove
          if (batch.length >= READ_BATCH_SIZE) {
            // Podeli veliki batch na manje delove za INSERT
            for (let i = 0; i < batch.length; i += INSERT_BATCH_SIZE) {
              const insertBatch = batch.slice(i, Math.min(i + INSERT_BATCH_SIZE, batch.length));
              await this.insertBatch(pool, insertBatch);
              importedCount += insertBatch.length;
            }
            batch = [];
          }
        }
      }
      
      // Umetni poslednji batch (takođe podeli ako je potrebno)
      if (batch.length > 0) {
        for (let i = 0; i < batch.length; i += INSERT_BATCH_SIZE) {
          const insertBatch = batch.slice(i, Math.min(i + INSERT_BATCH_SIZE, batch.length));
          await this.insertBatch(pool, insertBatch);
          importedCount += insertBatch.length;
        }
      }
      
      // Finalni rezultat - samo ovo ostaje
      // this.logger.log(`Imported: ${importedCount} records`);
      return { success: true, count: importedCount };
      
    } catch (error) {
      this.logger.error(`Production import error: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      
      // Dodatno logovanje za debug
      if (!process.env.TIMESCALE_DATABASE_URL) {
        this.logger.error('TIMESCALE_DATABASE_URL nije postavljen!');
      }
      
      return { success: false, count: importedCount };
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (endError) {
          this.logger.error(`Error closing pool: ${endError.message}`);
        }
      }
    }
  }

  /**
   * Umeće batch GPS podataka u TimescaleDB
   */
  private async insertBatch(pool: any, batch: any[]): Promise<void> {
    // this.logger.debug(`Inserting batch of ${batch.length} records`);
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Pripremi values za bulk insert
      // Imamo 11 parametara po redu, location se računa iz lng (param 5) i lat (param 4)
      const values = batch.map((row, i) => {
        const offset = i * 11; // 11 parametara po redu
        // Parametri: time, vehicle_id, garage_no, lat, lng, speed, course, alt, state, in_route, data_source
        return `(
          $${offset+1}, 
          $${offset+2}, 
          $${offset+3}, 
          $${offset+4}, 
          $${offset+5}, 
          ST_SetSRID(ST_MakePoint($${offset+5}, $${offset+4}), 4326),
          $${offset+6}, 
          $${offset+7}, 
          $${offset+8}, 
          $${offset+9}, 
          $${offset+10}, 
          $${offset+11}
        )`;
      }).join(',');
      
      const params = batch.flatMap(row => [
        row.time,
        row.vehicle_id,
        row.garage_no,
        row.lat,
        row.lng,
        row.speed,
        row.course,
        row.alt,
        row.state,
        row.in_route,
        'historical_import'
      ]);
      
      const query = `
        INSERT INTO gps_data (time, vehicle_id, garage_no, lat, lng, location, speed, course, alt, state, in_route, data_source)
        VALUES ${values}
        ON CONFLICT (vehicle_id, time) DO UPDATE SET
          garage_no = EXCLUDED.garage_no,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          location = EXCLUDED.location,
          speed = EXCLUDED.speed,
          course = EXCLUDED.course,
          alt = EXCLUDED.alt
      `;
      
      // Brojimo jedinstvene placeholder brojeve, ne sve $ znakove
      const maxPlaceholder = batch.length * 11; // Svaki red ima 11 parametara
      // Debug logovi isključeni - previše zagušuju konzolu
      // this.logger.debug(`Batch: ${batch.length} records, ${params.length} params`);
      
      if (params.length !== maxPlaceholder) {
        this.logger.error(`MISMATCH: Expected ${maxPlaceholder} params but have ${params.length}`);
      }
      
      // Debug: proveri prvih par parametara
      if (batch.length > 0) {
        // Debug informacije o batch-u - isključeno
        // this.logger.debug(`First record: ${JSON.stringify(batch[0]).substring(0, 50)}...`);
      }
      
      await client.query(query, params);
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Insert batch failed: ${error.message}`);
      this.logger.error(`Error code: ${error.code}, Detail: ${error.detail}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Poziva detekciju agresivne vožnje za vozilo u zadatom period
   */
  private async detectAggressiveDriving(
    vehicleId: number,
    garageNo: string, 
    syncFrom: Date,
    syncTo: Date
  ): Promise<number> {
    const { Pool } = require('pg');
    const pgPool = new Pool({
      connectionString: process.env.TIMESCALE_DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
      // Pozivamo batch detekciju dan po dan (kao u fast import script-u)
      const startDate = new Date(syncFrom);
      const endDate = new Date(syncTo);
      
      let currentDate = new Date(startDate);
      let totalDetectedEvents = 0;
      
      while (currentDate <= endDate) {
        const dayStart = currentDate.toISOString().split('T')[0] + ' 00:00:00';
        const dayEnd = currentDate.toISOString().split('T')[0] + ' 23:59:59';
        
        try {
          const result = await pgPool.query(`
            SELECT detect_aggressive_driving_batch(
              $1::INTEGER,
              $2::VARCHAR,
              $3::TIMESTAMPTZ,
              $4::TIMESTAMPTZ
            );
          `, [vehicleId, garageNo, dayStart, dayEnd]);
          
          // Result je tabela sa kolona total_events
          if (result.rows && result.rows[0]) {
            const dayEvents = parseInt(result.rows[0].detect_aggressive_driving_batch) || 0;
            totalDetectedEvents += dayEvents;
          }
        } catch (dayError) {
          // Loguj grešku ali nastavi sa sledećim danom
          this.logger.warn(`Greška u detekciji za ${currentDate.toISOString().split('T')[0]}: ${dayError.message}`);
        }
        
        // Pređi na sledeći dan
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      this.logger.log(`🎯 Detektovano ${totalDetectedEvents} agresivnih događaja za vozilo ${garageNo}`);
      
      return totalDetectedEvents;
      
    } finally {
      await pgPool.end();
    }
  }

  /**
   * Sinhronizuje batch vozila sa zadatim parametrima
   * Koristi se za Smart Slow Sync
   */
  async syncVehiclesBatch(
    vehicleIds: number[], 
    syncDaysBack: number = 30,
    maxWorkers: number = 2
  ): Promise<{
    successCount: number;
    failedVehicles: number[];
    totalGpsPoints?: number;
  }> {
    this.logger.log(`Starting batch sync for ${vehicleIds.length} vehicles with ${maxWorkers} workers`);
    
    let successCount = 0;
    const failedVehicles: number[] = [];
    let totalGpsPoints = 0;

    // Podeli vozila na batch-ove za worker-e
    const batchSize = Math.ceil(vehicleIds.length / maxWorkers);
    const batches: number[][] = [];
    
    for (let i = 0; i < vehicleIds.length; i += batchSize) {
      batches.push(vehicleIds.slice(i, i + batchSize));
    }

    // Pokreni worker-e paralelno
    const promises = batches.map(async (batch, index) => {
      const workerId = `slow-sync-worker-${index + 1}`;
      
      for (const vehicleId of batch) {
        try {
          const vehicle = await this.prisma.busVehicle.findUnique({
            where: { id: vehicleId },
            select: {
              id: true,
              garageNumber: true,
              legacyId: true,
            }
          });

          if (!vehicle || !vehicle.garageNumber) {
            this.logger.warn(`Vehicle ${vehicleId} not found or missing garage number`);
            failedVehicles.push(vehicleId);
            continue;
          }

          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - syncDaysBack);

          // Pripremi vehicle objekat za postojeću metodu
          const vehicleData = {
            id: vehicle.id,
            garage_number: vehicle.garageNumber,
            legacy_id: vehicle.legacyId
          };

          const result = await this.syncVehicleWithWorker(
            index + 1, // workerId as number
            vehicleData,
            startDate,
            endDate
          );

          if (result.status === 'completed') {
            successCount++;
            totalGpsPoints += result.processedRecords || 0;
            this.logger.log(`[${workerId}] Vehicle ${vehicle.garageNumber} synced successfully`);
          } else {
            failedVehicles.push(vehicleId);
            this.logger.error(`[${workerId}] Vehicle ${vehicle.garageNumber} sync failed`);
          }

        } catch (error) {
          this.logger.error(`[${workerId}] Error syncing vehicle ${vehicleId}: ${error.message}`);
          failedVehicles.push(vehicleId);
        }
      }
    });

    await Promise.all(promises);

    this.logger.log(`Batch sync completed: ${successCount} success, ${failedVehicles.length} failed`);

    return {
      successCount,
      failedVehicles,
      totalGpsPoints
    };
  }
}