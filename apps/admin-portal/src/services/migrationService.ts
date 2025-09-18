import axios from 'axios';
import { TokenManager } from '../utils/token';

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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

class MigrationService {
  private getHeaders() {
    const token = TokenManager.getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  }

  async getStatus(): Promise<MigrationStatus> {
    const response = await axios.get(`${API_URL}/api/migration/status`, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async startMigration(startDate?: string, endDate?: string, resume?: boolean, useParallel?: boolean): Promise<{ success: boolean; message: string }> {
    console.log('MigrationService.startMigration called with:', { startDate, endDate, resume, useParallel });
    console.log('API_URL:', API_URL);
    console.log('Full URL:', `${API_URL}/api/migration/start`);
    console.log('Headers:', this.getHeaders());

    try {
      const response = await axios.post(
        `${API_URL}/api/migration/start`,
        {
          startDate,
          endDate,
          resume: resume || false,
          useParallel: useParallel !== false // Default true
        },
        {
          headers: this.getHeaders()
        }
      );
      console.log('Migration service response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Migration service error:', error);
      throw error;
    }
  }

  async abortMigration(): Promise<{ success: boolean; message: string }> {
    const response = await axios.post(`${API_URL}/api/migration/abort`, {}, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async verifyMigration(): Promise<VerificationResult> {
    const response = await axios.get(`${API_URL}/api/migration/verify`, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async getLogs(limit: number = 50): Promise<{ logs: MigrationLog[] }> {
    const response = await axios.get(`${API_URL}/api/migration/logs?limit=${limit}`, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async getRangeProgress(date: string): Promise<{ date: string; ranges: RangeProgress[] }> {
    const response = await axios.get(`${API_URL}/api/migration/range-progress/${date}`, {
      headers: this.getHeaders()
    });
    return response.data;
  }
}

export default new MigrationService();