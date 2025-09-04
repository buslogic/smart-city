import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as mysql from 'mysql2/promise';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Client } from 'pg';

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
  
  constructor(private readonly prisma: PrismaService) {}

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
    syncTo: Date
  ): Promise<string> {
    const jobId = uuidv4();
    const jobs: SyncJob[] = [];

    try {
      // Dobavi informacije o vozilima
      const vehicles = await this.prisma.$queryRaw<any[]>`
        SELECT id, garage_number, legacy_database 
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
        });
      }

      this.syncJobs.set(jobId, jobs);

      // Pokreni asinhroni sync proces
      this.runSyncProcess(jobId, vehicles, syncFrom, syncTo);

      return jobId;
    } catch (error) {
      this.logger.error('Error starting legacy sync', error);
      throw error;
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
        this.logger.log(`Starting sync for vehicle ${vehicle.garage_number}`);

        // Izvršava import preko SSH-a i postojeće skripte
        await this.performVehicleSync(vehicle, syncFrom, syncTo, job);

        job.status = 'completed';
        job.completed_at = new Date();
        job.progress_percentage = 100;
        
        this.logger.log(`Completed sync for vehicle ${vehicle.garage_number}`);
      } catch (error) {
        job.status = 'error';
        job.error_message = error.message;
        job.completed_at = new Date();
        
        this.logger.error(`Error syncing vehicle ${vehicle.garage_number}`, error);
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
    
    try {
      // Step 1: Export podataka sa legacy servera
      this.logger.log(`Exporting data for ${garageNo} from ${syncFrom.toISOString()} to ${syncTo.toISOString()}`);
      
      const exportFileName = `${garageNo}_${Date.now()}.sql.gz`;
      const exportPath = `/tmp/${exportFileName}`;
      const localPath = path.join('/home/kocev/smart-city/scripts', exportFileName);
      
      // SSH komanda za export podataka sa date range filterom
      const fromDate = syncFrom.toISOString().split('T')[0];
      const toDate = syncTo.toISOString().split('T')[0];
      
      const sshExportCmd = `ssh -i ${this.SSH_KEY_PATH} root@${this.LEGACY_HOST} "
        cd /tmp && 
        mysqldump -uroot ${this.LEGACY_DB} ${tableName} \\
          --where=\\"captured >= '${fromDate} 00:00:00' AND captured <= '${toDate} 23:59:59'\\" | \\
          gzip > ${exportFileName} &&
        ls -lh ${exportFileName}
      "`;
      
      await execAsync(sshExportCmd);
      job.progress_percentage = 25;
      
      // Step 2: Transfer fajla sa legacy servera
      this.logger.log(`Transferring data for ${garageNo}`);
      const scpCmd = `scp -i ${this.SSH_KEY_PATH} root@${this.LEGACY_HOST}:/tmp/${exportFileName} ${localPath}`;
      await execAsync(scpCmd);
      job.progress_percentage = 50;
      
      // Step 3: Pokreni fast-import skriptu
      this.logger.log(`Importing data for ${garageNo}`);
      const importScript = '/home/kocev/smart-city/scripts/fast-import-gps-to-timescale-docker.sh';
      const importCmd = `${importScript} ${localPath} ${garageNo}`;
      
      const { stdout, stderr } = await execAsync(importCmd, {
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      // Parse output za broj importovanih zapisa
      const importedMatch = stdout.match(/Importovano GPS tačaka:\s*(\d+)/);
      if (importedMatch) {
        job.processed_records = parseInt(importedMatch[1]);
        job.total_records = job.processed_records;
      }
      
      job.progress_percentage = 90;
      
      // Step 4: Cleanup
      this.logger.log(`Cleaning up temporary files for ${garageNo}`);
      await execAsync(`rm -f ${localPath}`);
      await execAsync(`ssh -i ${this.SSH_KEY_PATH} root@${this.LEGACY_HOST} "rm -f /tmp/${exportFileName}"`);
      
      job.progress_percentage = 100;
      this.logger.log(`Successfully synced ${job.processed_records} records for ${garageNo}`);
      
    } catch (error) {
      this.logger.error(`Error performing sync for ${garageNo}`, error);
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