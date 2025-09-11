import axios from 'axios';
import { TokenManager } from '../utils/token';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

export interface TimescaleTable {
  schemaname: string;
  tablename: string;
  size: string;
  column_count: string;
  is_hypertable: boolean;
  description: string | null;
  row_count: number | null;
  hypertable_info: {
    hypertable_schema: string;
    hypertable_name: string;
    owner: string;
    num_dimensions: number;
    num_chunks: number;
    compression_enabled: boolean;
    tablespaces: string[] | null;
    total_size?: string;
    index_size?: string;
  } | null;
}

export interface ContinuousAggregate {
  view_schema: string;
  view_name: string;
  materialization_hypertable_schema: string;
  materialization_hypertable_name: string;
  view_definition: string;
  compression_enabled: boolean;
  finalized: boolean;
  size: string;
  row_count: number | null;
  refresh_policy: {
    refresh_interval?: string;
    start_offset?: string;
    end_offset?: string;
    next_run?: string;
    last_status?: string;
  } | null;
}

export interface TableStatistics {
  schemaname: string;
  tablename: string;
  live_rows: number;
  dead_rows: number;
  modifications_since_analyze: number;
  last_vacuum: string | null;
  last_autovacuum: string | null;
  last_analyze: string | null;
  last_autoanalyze: string | null;
  vacuum_count: number;
  autovacuum_count: number;
  analyze_count: number;
  autoanalyze_count: number;
}

export const timescaledbService = {
  getTables: async (): Promise<TimescaleTable[]> => {
    const token = TokenManager.getAccessToken();
    const response = await axios.get(`${API_URL}/api/timescaledb/tables`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  getContinuousAggregates: async (): Promise<ContinuousAggregate[]> => {
    const token = TokenManager.getAccessToken();
    const response = await axios.get(`${API_URL}/api/timescaledb/continuous-aggregates`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  getTableStatistics: async (schema: string, table: string): Promise<TableStatistics | null> => {
    const token = TokenManager.getAccessToken();
    const response = await axios.get(`${API_URL}/api/timescaledb/tables/${schema}/${table}/statistics`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  refreshContinuousAggregate: async (
    name: string, 
    startTime?: string, 
    endTime?: string
  ): Promise<any> => {
    const token = TokenManager.getAccessToken();
    const response = await axios.post(
      `${API_URL}/api/timescaledb/continuous-aggregates/${name}/refresh`,
      { startTime, endTime },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  },

  getContinuousAggregatesStatus: async (): Promise<any> => {
    const token = TokenManager.getAccessToken();
    const response = await axios.get(`${API_URL}/api/timescaledb/continuous-aggregates/status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  getTimescaleJobs: async (): Promise<any> => {
    const token = TokenManager.getAccessToken();
    const response = await axios.get(`${API_URL}/api/timescaledb/continuous-aggregates/jobs`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },
};