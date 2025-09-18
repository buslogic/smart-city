import { api } from './api';

export interface MigrationStatus {
  status: 'not_started' | 'initialized' | 'ready_for_migration' | 'running' | 'completed' | 'error' | 'aborted' | string;
  progressPercent: number;
  recordsMigrated: number;
  estimatedTotal: number;
  currentDate?: string;
  startDate?: string;
  endDate?: string;
  runningTime?: string;
  recordsPerSecond: number;
  eta?: string;
  lastLogs?: MigrationLog[];
  error_message?: string;
}

export interface MigrationLog {
  id: number;
  action: string;
  message: string;
  recordsAffected?: number;
  createdAt: string;
}

export interface VerificationResult {
  checks: Array<{
    checkName: string;
    originalValue: string;
    fixedValue: string;
    status: 'OK' | 'MISMATCH' | 'CHECK';
  }>;
}

export interface RangeProgress {
  rangeName: string;
  startTime: string;
  endTime: string;
  estimatedRecords: number;
  migratedRecords: number;
  progressPercent: number;
}

class MigrationService {
  async getStatus(): Promise<MigrationStatus> {
    const response = await api.get('/api/migration/status');
    return response.data;
  }

  async startMigration(startDate?: string, endDate?: string, resume?: boolean, useParallel?: boolean): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post(
        '/api/migration/start',
        {
          startDate,
          endDate,
          resume: resume || false,
          useParallel: useParallel !== false // Default true
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async abortMigration(): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/api/migration/abort', {});
    return response.data;
  }

  async verifyMigration(): Promise<VerificationResult> {
    const response = await api.get('/api/migration/verify');
    return response.data;
  }

  async getLogs(limit: number = 50): Promise<{ logs: MigrationLog[] }> {
    const response = await api.get(`/api/migration/logs?limit=${limit}`);
    return response.data;
  }

  async getRangeProgress(date: string): Promise<{ date: string; ranges: RangeProgress[] }> {
    const response = await api.get(`/api/migration/range-progress/${date}`);
    return response.data;
  }
}

export default new MigrationService();