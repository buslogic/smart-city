import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as mysql from 'mysql2/promise';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Client } from 'pg';
import { LegacySyncWorkerPoolService } from './legacy-sync-worker-pool.service';

const execAsync = promisify(exec);

interface VehicleWithSyncStatus {
  id: number;
  garage_number: string;
  vehicle_model: string;
  registration_number: string;
  last_sync_date: Date | null;
  total_gps_points: number;
  sync_status: 'never' | 'syncing' | 'completed' | 'error';
  last_sync_error: string | null;
  legacy_table_name: string;
  legacy_database: string;
}

interface SyncJob {
  id: string;
  vehicle_id: number;
  garage_number: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress_percentage: number;
  total_records: number;
  processed_records: number;
  error_message?: string;
  started_at?: Date;
  completed_at?: Date;
  logs: string[];
  currentStep?: string;
}

@Injectable()
export class LegacySyncService {
  private readonly logger = new Logger(LegacySyncService.name);
  private syncJobs: Map<string, SyncJob[]> = new Map();
  private sshTunnel: any = null;
  
  // Legacy server configuration
  private readonly LEGACY_HOST = process.env.LEGACY_SERVER_HOST || '79.101.48.11';
  private readonly SSH_KEY_PATH = process.env.LEGACY_SSH_KEY_PATH || '~/.ssh/hp-notebook-2025-buslogic';
  private readonly LEGACY_DB = 'pib100065430gps'; // Gradska GPS Ticketing Baza
  private readonly LEGACY_USER = 'root';
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly workerPoolService: LegacySyncWorkerPoolService
  ) {}

  async getVehiclesWithSyncStatus(): Promise<VehicleWithSyncStatus[]> {
    try {
      // Dobavi sve vozila iz naše baze
      const vehicles = await this.prisma.$queryRaw<any[]>`
        SELECT 
          v.id,
          v.garage_number,
          v.vehicle_model,
          v.registration_number,
          v.legacy_id
        FROM bus_vehicles v
        WHERE v.garage_number IS NOT NULL
          AND v.garage_number != ''
        ORDER BY v.garage_number
      `;

      // Dobavi poslednje sync datume direktno iz TimescaleDB
      let syncDates: any[] = [];
      const pgClient = new Client({
        connectionString: process.env.TIMESCALE_DATABASE_URL || 
          'postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps?sslmode=disable',
      });
      
      try {
        await pgClient.connect();
        const result = await pgClient.query(`
          SELECT 
            vehicle_id,
            MAX(time) as last_sync_date,
            COUNT(*) as total_points
          FROM gps_data
          GROUP BY vehicle_id
        `);
        syncDates = result.rows;
        this.logger.debug(`Fetched sync data for ${result.rows.length} vehicles from TimescaleDB`);
      } catch (error) {
        this.logger.warn('Could not fetch sync dates from TimescaleDB', error);
      } finally {
        await pgClient.end();
      }

      // Kreiraj mapu za brži pristup
      const syncMap = new Map();
      syncDates.forEach(s => {
        syncMap.set(s.vehicle_id, {
          last_sync: s.last_sync_date,
          total_points: parseInt(s.total_points)
        });
      });

      // Mapuj rezultate sa dodatnim informacijama
      return vehicles.map(v => {
        const syncData = syncMap.get(v.id);
        return {
          id: v.id,
          garage_number: v.garage_number,
          vehicle_model: v.vehicle_model || 'N/A',
          registration_number: v.registration_number || 'N/A',
          last_sync_date: syncData?.last_sync || null,
          total_gps_points: syncData?.total_points || 0,
          sync_status: this.getSyncStatusForVehicle(v.id),
          last_sync_error: null,
          legacy_table_name: `${v.garage_number}gps`,
          legacy_database: this.LEGACY_DB,
        };
      });
    } catch (error) {
      this.logger.error('Error fetching vehicles with sync status', error);
      throw error;
    }
  }

  private getSyncStatusForVehicle(vehicleId: number): 'never' | 'syncing' | 'completed' | 'error' {
    // Proveri da li postoji aktivan sync job za ovo vozilo
    for (const jobs of this.syncJobs.values()) {
      const job = jobs.find(j => j.vehicle_id === vehicleId);
      if (job) {
        if (job.status === 'running' || job.status === 'pending') {
          return 'syncing';
        }
        if (job.status === 'error') {
          return 'error';
        }
      }
    }
    return 'never';
  }

  async startLegacySync(
    vehicleIds: number[], 
    syncFrom: Date, 
    syncTo: Date,
    refreshAggregates: boolean = false
  ): Promise<string> {
    const jobId = uuidv4();
    const jobs: SyncJob[] = [];

    try {
      // Dobavi informacije o vozilima
      const vehicles = await this.prisma.$queryRaw<any[]>`
        SELECT id, garage_number, legacy_id 
        FROM bus_vehicles 
        WHERE id IN (${vehicleIds.map(id => id).join(',')})
      `;

      // Kreiraj sync job za svako vozilo
      for (const vehicle of vehicles) {
        jobs.push({
          id: jobId,
          vehicle_id: vehicle.id,
          garage_number: vehicle.garage_number,
          status: 'pending',
          progress_percentage: 0,
          total_records: 0,
          processed_records: 0,
          started_at: new Date(),
          logs: [],
        });
      }

      this.syncJobs.set(jobId, jobs);

      // Proveri da li koristiti Worker Pool
      const useWorkerPool = await this.shouldUseWorkerPool();
      
      if (useWorkerPool) {
        // NOVO: Koristi Worker Pool za paralelno procesiranje
        this.logger.log(`🚀 Koristi se Worker Pool za ${vehicleIds.length} vozila`);
        this.runSyncProcessWithWorkerPool(jobId, vehicleIds, syncFrom, syncTo, refreshAggregates)
          .catch(error => {
            this.logger.error(`Worker Pool sync failed for job ${jobId}:`, error);
          });
      } else {
        // STARO: Sekvencijalno procesiranje
        this.logger.log(`📝 Koristi se standardno sekvencijalno procesiranje`);
        this.runSyncProcess(jobId, vehicles, syncFrom, syncTo)
          .catch(error => {
            this.logger.error(`Sync process failed for job ${jobId}:`, error);
          });
      }

      return jobId;
    } catch (error) {
      this.logger.error('Error starting legacy sync', error);
      throw error;
    }
  }
  
  private async shouldUseWorkerPool(): Promise<boolean> {
    try {
      const setting = await this.prisma.systemSettings.findFirst({
        where: { 
          key: 'legacy_sync.worker_pool.enabled',
          category: 'legacy_sync'
        }
      });
      return setting?.value === 'true';
    } catch {
      return false; // Default na staro ponašanje ako nema podešavanja
    }
  }
  
  private async runSyncProcessWithWorkerPool(
    jobId: string,
    vehicleIds: number[],
    syncFrom: Date,
    syncTo: Date,
    refreshAggregates: boolean = false
  ) {
    const jobs = this.syncJobs.get(jobId);
    if (!jobs) return;

    try {
      // Pokreni Worker Pool
      const results = await this.workerPoolService.startWorkerPoolSync(
        vehicleIds,
        syncFrom,
        syncTo,
        jobId,
        refreshAggregates
      );
      
      // Ažuriraj job statuse prema rezultatima
      results.forEach((result, vehicleId) => {
        const job = jobs.find(j => j.vehicle_id === vehicleId);
        if (job) {
          job.status = result.status === 'failed' ? 'error' : result.status;
          job.processed_records = result.processedRecords;
          job.total_records = result.totalRecords;
          job.completed_at = result.endTime;
          job.progress_percentage = 100;
          job.logs = [...job.logs, ...result.logs];
          if (result.error) {
            job.error_message = result.error;
          }
        }
      });
      
      this.logger.log(`✅ Worker Pool sinhronizacija završena za job ${jobId}`);
    } catch (error) {
      this.logger.error(`Worker Pool greška za job ${jobId}:`, error);
      jobs.forEach(job => {
        job.status = 'error';
        job.error_message = error.message;
        job.completed_at = new Date();
      });
    }
  }

  private async runSyncProcess(
    jobId: string, 
    vehicles: any[], 
    syncFrom: Date, 
    syncTo: Date
  ) {
    const jobs = this.syncJobs.get(jobId);
    if (!jobs) return;

    for (const vehicle of vehicles) {
      const job = jobs.find(j => j.vehicle_id === vehicle.id);
      if (!job) continue;

      try {
        job.status = 'running';
        job.logs.push(`🚀 Početak sinhronizacije za vozilo ${vehicle.garage_number}`);

        // Izvršava import preko SSH-a i postojeće skripte
        await this.performVehicleSync(vehicle, syncFrom, syncTo, job);

        job.status = 'completed';
        job.completed_at = new Date();
        job.progress_percentage = 100;
        
        job.logs.push(`✅ Završena sinhronizacija za vozilo ${vehicle.garage_number}`);
      } catch (error) {
        job.status = 'error';
        job.error_message = error.message;
        job.completed_at = new Date();
        job.logs.push(`❌ Greška pri sinhronizaciji: ${error.message}`);
      }
    }
  }

  private async performVehicleSync(
    vehicle: any, 
    syncFrom: Date, 
    syncTo: Date,
    job: SyncJob
  ) {
    const garageNo = vehicle.garage_number;
    const tableName = `${garageNo}gps`;
    // Deklariši varijable van try bloka da budu dostupne u catch
    let exportFileName = '';
    let localPath = '';
    
    try {
      // Sada inicijalizuj varijable
      exportFileName = `${garageNo}_${Date.now()}.sql.gz`;
      const exportPath = `/tmp/${exportFileName}`;
      // Koristi /tmp direktorijum koji uvek postoji
      localPath = path.join('/tmp', exportFileName);
      // Step 1: Export podataka sa legacy servera
      job.logs.push(`📅 Period: ${syncFrom.toISOString().split('T')[0]} do ${syncTo.toISOString().split('T')[0]}`);
      
      // SSH komanda za export podataka sa date range filterom
      const fromDate = syncFrom.toISOString().split('T')[0];
      const toDate = syncTo.toISOString().split('T')[0];
      
      // Prvo proveri koliko ima zapisa
      const countCmd = `ssh -i ${this.SSH_KEY_PATH} root@${this.LEGACY_HOST} "mysql -uroot ${this.LEGACY_DB} -e 'SELECT COUNT(*) as total FROM ${tableName} WHERE captured >= \\"${fromDate} 00:00:00\\" AND captured <= \\"${toDate} 23:59:59\\"'"`;
      
      job.logs.push(`📊 Brojanje GPS tačaka za ${garageNo} u periodu ${fromDate} do ${toDate}`);
      const { stdout: countOutput } = await execAsync(countCmd);
      const totalMatch = countOutput.match(/(\d+)/);
      const totalRecords = totalMatch ? parseInt(totalMatch[1]) : 0;
      
      job.logs.push(`✅ Pronađeno ${totalRecords.toLocaleString()} GPS tačaka za ${garageNo}`);
      job.total_records = totalRecords;
      
      if (totalRecords === 0) {
        job.logs.push(`⚠️ Nema GPS podataka za ${garageNo} u zadatom periodu`);
        job.status = 'completed';
        job.progress_percentage = 100;
        job.processed_records = 0;
        return;
      }
      
      const sshExportCmd = `ssh -i ${this.SSH_KEY_PATH} root@${this.LEGACY_HOST} "
        cd /tmp && 
        mysqldump -uroot ${this.LEGACY_DB} ${tableName} \\
          --where=\\"captured >= '${fromDate} 00:00:00' AND captured <= '${toDate} 23:59:59'\\" | \\
          gzip > ${exportFileName} &&
        ls -lh ${exportFileName}
      "`;
      
      job.logs.push(`💾 Kreiranje SQL dump fajla za ${totalRecords.toLocaleString()} GPS tačaka...`);
      job.currentStep = 'Eksportovanje podataka';
      const { stdout: exportOutput } = await execAsync(sshExportCmd);
      const fileSizeMatch = exportOutput.match(/(\d+\.?\d*[KMG])/);
      const fileSize = fileSizeMatch ? fileSizeMatch[1] : 'N/A';
      job.logs.push(`✅ Dump fajl kreiran: ${exportFileName} (${fileSize}B)`);
      job.progress_percentage = 25;
      
      // Step 2: Transfer fajla sa legacy servera
      job.logs.push(`📥 Preuzimanje dump fajla sa legacy servera (${fileSize}B)...`);
      job.currentStep = 'Transfer podataka';
      const scpCmd = `scp -i ${this.SSH_KEY_PATH} root@${this.LEGACY_HOST}:/tmp/${exportFileName} ${localPath}`;
      const transferStart = Date.now();
      await execAsync(scpCmd);
      const transferTime = ((Date.now() - transferStart) / 1000).toFixed(1);
      job.logs.push(`✅ Fajl preuzet za ${transferTime}s`);
      job.progress_percentage = 50;
      
      // Step 3: Import podataka
      job.logs.push(`🗄️ Import podataka u TimescaleDB bazu...`);
      job.currentStep = 'Import u bazu';
      
      // Odaberi skriptu na osnovu okruženja
      let importCmd: string;
      if (process.env.NODE_ENV === 'production' && process.env.TIMESCALE_DATABASE_URL) {
        job.logs.push(`📥 Koristi se produkcijski import metod...`);
        // Na produkciji koristi skriptu koja se kreira runtime
        importCmd = `bash /app/scripts/fast-import-gps-to-timescale-production.sh ${localPath} ${garageNo}`;
      } else {
        // Development: koristi Docker skriptu
        const importScript = '/home/kocev/smart-city/scripts/fast-import-gps-to-timescale-docker.sh';
        importCmd = `${importScript} ${localPath} ${garageNo}`;
      }
      
      // Postavi progress na 60% pre importa
      job.progress_percentage = 60;
      
      // Dodaj početni log koji će se ažurirati
      const processingLogIndex = job.logs.length;
      job.logs.push(`⏳ Procesiranje ${totalRecords.toLocaleString()} GPS tačaka...`);
      
      const importStart = Date.now();
      
      // Koristi spawn umesto execAsync da možemo da pratimo output u realnom vremenu
      const { spawn } = await import('child_process');
      const importProcess = spawn('bash', ['-c', importCmd]);
      
      let importOutput = '';
      let lastBatchUpdate = 0;
      
      // Prati stdout u realnom vremenu
      importProcess.stdout.on('data', (data) => {
        const output = data.toString();
        importOutput += output;
        
        // Traži batch progres u output-u
        const batchMatch = output.match(/Batch (\d+)\/(\d+): Importujem linije (\d+)-(\d+)/);
        if (batchMatch) {
          const currentBatch = parseInt(batchMatch[1]);
          const totalBatches = parseInt(batchMatch[2]);
          const endLine = parseInt(batchMatch[4]);
          
          // Ažuriraj postojeći log umesto dodavanja novog
          const elapsedTime = ((Date.now() - importStart) / 1000).toFixed(0);
          job.logs[processingLogIndex] = `⏳ Procesiranje ${totalRecords.toLocaleString()} GPS tačaka... [Batch ${currentBatch}/${totalBatches}] - ${endLine.toLocaleString()}/${totalRecords.toLocaleString()} tačaka (${elapsedTime}s)`;
          
          // Ažuriraj progress percentage proporcionalno
          const batchProgress = (currentBatch / totalBatches) * 30; // 30% od 60% do 90%
          job.progress_percentage = Math.floor(60 + batchProgress);
          
          lastBatchUpdate = currentBatch;
        }
        
        // Proveri za dan po dan procesiranje (za aggressive driving)
        const dayMatch = output.match(/Dan (\d+): (\d{4}-\d{2}-\d{2})/);
        if (dayMatch) {
          const dayCount = parseInt(dayMatch[1]);
          const currentDate = dayMatch[2];
          const elapsedTime = ((Date.now() - importStart) / 1000).toFixed(0);
          job.logs[processingLogIndex] = `🚗 Analiza agresivne vožnje... [Dan ${dayCount}] ${currentDate} (${elapsedTime}s)`;
          job.currentStep = 'Analiza vožnje';
          job.progress_percentage = 85;
        }
        
        // Proveri za ukupan broj dana
        const totalDaysMatch = output.match(/Ukupno procesiranih dana: (\d+)/);
        if (totalDaysMatch) {
          const totalDays = parseInt(totalDaysMatch[1]);
          job.logs[processingLogIndex] = `✅ Analiza agresivne vožnje završena za ${totalDays} dana`;
          job.progress_percentage = 88;
        }
        
        // Proveri za refresh continuous aggregates
        if (output.includes('Step 5: Osvežavam continuous aggregates')) {
          job.logs[processingLogIndex] = `📈 Osvežavanje statistika...`;
          job.currentStep = 'Osvežavanje statistika';
          job.progress_percentage = 90;
        }
        
        // Proveri za mesečno osvežavanje
        const monthMatch = output.match(/Mesec (\d{4}-\d{2}-\d{2})/);
        if (monthMatch) {
          const currentMonth = monthMatch[1];
          job.logs[processingLogIndex] = `📈 Osvežavanje statistika... Mesec: ${currentMonth}`;
          job.progress_percentage = 92;
        }
        
        // Proveri za čišćenje fajlova
        if (output.includes('Step 6: Čistim privremene fajlove')) {
          job.logs[processingLogIndex] = `🧹 Čišćenje privremenih fajlova...`;
          job.currentStep = 'Finalizacija';
          job.progress_percentage = 95;
        }
        
        // Proveri za finalne statistike
        if (output.includes('REZULTATI IMPORTA')) {
          job.logs[processingLogIndex] = `📊 Priprema finalnih statistika...`;
          job.progress_percentage = 98;
        }
      });
      
      // Prati stderr takođe
      importProcess.stderr.on('data', (data) => {
        importOutput += data.toString();
      });
      
      // Čekaj da se proces završi
      await new Promise<void>((resolve, reject) => {
        importProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Import process failed with code ${code}`));
          }
        });
        
        importProcess.on('error', (err) => {
          reject(err);
        });
      });
      
      const importTime = ((Date.now() - importStart) / 1000).toFixed(1);
      
      // Finalni log sa završenim statusom
      job.logs[processingLogIndex] = `✅ Procesiranje završeno za ${importTime}s`;
      
      // Parse output za broj importovanih zapisa
      const importedMatch = importOutput.match(/Importovano GPS tačaka:\s*(\d+)/);
      if (importedMatch) {
        job.processed_records = parseInt(importedMatch[1]);
        job.total_records = totalRecords; // Koristi prethodno prebrojane zapise
        job.logs.push(`✅ Import završen: ${job.processed_records.toLocaleString()} tačaka za ${importTime}s`);
      }
      
      // Progress je već ažuriran kroz real-time praćenje
      if (!importOutput.includes('aggressive_driving')) {
        job.progress_percentage = 90;
      }
      
      // Step 4: Cleanup
      job.logs.push(`🧹 Brisanje privremenih fajlova...`);
      job.currentStep = 'Finalizacija';
      
      // Pokušaj da obrišeš fajlove čak i ako je bilo grešaka
      try {
        await execAsync(`rm -f ${localPath}`);
        job.logs.push(`✅ Obrisan lokalni fajl`);
      } catch (cleanupError) {
        job.logs.push(`⚠️ Nije moguće obrisati lokalni fajl: ${cleanupError.message}`);
      }
      
      try {
        await execAsync(`ssh -i ${this.SSH_KEY_PATH} root@${this.LEGACY_HOST} "rm -f /tmp/${exportFileName}"`);
        job.logs.push(`✅ Obrisan fajl sa legacy servera`);
      } catch (cleanupError) {
        job.logs.push(`⚠️ Nije moguće obrisati fajl sa legacy servera: ${cleanupError.message}`);
      }
      
      job.progress_percentage = 100;
      job.logs.push(`✅ Uspešno sinhronizovano ${job.processed_records.toLocaleString()} GPS tačaka za vozilo ${garageNo}`);
      
    } catch (error) {
      job.logs.push(`❌ Greška pri sinhronizaciji vozila ${garageNo}: ${error.message}`);
      
      // Pokušaj cleanup čak i ako je bilo greške
      try {
        await execAsync(`rm -f ${localPath}`);
      } catch {}
      try {
        await execAsync(`ssh -i ${this.SSH_KEY_PATH} root@${this.LEGACY_HOST} "rm -f /tmp/${exportFileName}"`);
      } catch {}
      
      throw error;
    }
  }

  async getSyncProgress(jobId?: string): Promise<SyncJob[]> {
    if (jobId) {
      return this.syncJobs.get(jobId) || [];
    }
    
    // Vrati sve aktivne sync jobove
    const allJobs: SyncJob[] = [];
    for (const jobs of this.syncJobs.values()) {
      allJobs.push(...jobs.filter(j => 
        j.status === 'running' || j.status === 'pending'
      ));
    }
    return allJobs;
  }

  async stopSync(jobId: string): Promise<void> {
    const jobs = this.syncJobs.get(jobId);
    if (jobs) {
      jobs.forEach(job => {
        if (job.status === 'running' || job.status === 'pending') {
          job.status = 'error';
          job.error_message = 'Sync cancelled by user';
          job.completed_at = new Date();
        }
      });
    }
  }

  async testLegacyConnection(): Promise<{
    connected: boolean;
    server: string;
    database: string;
    message: string;
    vehicle_count?: number;
  }> {
    try {
      // Test SSH konekcije i MySQL pristupa
      const testCmd = `ssh -i ${this.SSH_KEY_PATH} root@${this.LEGACY_HOST} "
        mysql -uroot ${this.LEGACY_DB} -e \\"
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = '${this.LEGACY_DB}' 
            AND table_name LIKE '%gps';
        \\"
      "`;
      
      const { stdout } = await execAsync(testCmd);
      
      // Parse broj tabela
      const countMatch = stdout.match(/(\d+)/);
      const tableCount = countMatch ? parseInt(countMatch[1]) : 0;
      
      return {
        connected: true,
        server: this.LEGACY_HOST,
        database: this.LEGACY_DB,
        message: `Successfully connected. Found ${tableCount} GPS tables.`,
        vehicle_count: tableCount
      };
    } catch (error) {
      this.logger.error('Legacy connection test failed', error);
      return {
        connected: false,
        server: this.LEGACY_HOST,
        database: this.LEGACY_DB,
        message: `Connection failed: ${error.message}`
      };
    }
  }
}