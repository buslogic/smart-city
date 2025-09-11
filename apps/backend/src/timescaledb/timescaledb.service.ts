import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'pg';

@Injectable()
export class TimescaledbService {
  private readonly logger = new Logger(TimescaledbService.name);

  private async getConnection(): Promise<Client> {
    if (!process.env.TIMESCALE_DATABASE_URL) {
      throw new Error('TIMESCALE_DATABASE_URL environment variable is not set');
    }
    
    const client = new Client({
      connectionString: process.env.TIMESCALE_DATABASE_URL,
    });
    
    await client.connect();
    return client;
  }

  async getTables() {
    const client = await this.getConnection();
    
    try {
      // Query samo za public schema tabele sa ispravnim računanjem veličine za hypertables
      const query = `
        SELECT 
          schemaname,
          tablename,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM timescaledb_information.hypertables h
              WHERE h.hypertable_schema = t.schemaname 
              AND h.hypertable_name = t.tablename
            ) THEN (
              SELECT pg_size_pretty(hypertable_size(format('%I.%I', t.schemaname, t.tablename)::regclass))
            )
            ELSE pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
          END AS size,
          (SELECT COUNT(*) FROM information_schema.columns 
           WHERE table_schema = t.schemaname 
           AND table_name = t.tablename) as column_count,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM timescaledb_information.hypertables h
              WHERE h.hypertable_schema = t.schemaname 
              AND h.hypertable_name = t.tablename
            ) THEN true
            ELSE false
          END as is_hypertable,
          obj_description((schemaname||'.'||tablename)::regclass, 'pg_class') as description
        FROM pg_tables t
        WHERE schemaname = 'public'
        ORDER BY tablename;
      `;

      const result = await client.query(query);
      
      // Za svaku tabelu, dobavi broj redova
      const tablesWithRowCount = await Promise.all(
        result.rows.map(async (table) => {
          try {
            let countQuery: string;
            if (table.is_hypertable) {
              // Za hypertables koristimo TimescaleDB approximate_row_count funkciju
              countQuery = `SELECT approximate_row_count('${table.schemaname}.${table.tablename}')::bigint as row_count`;
            } else {
              // Za obične tabele koristimo COUNT sa limitom
              countQuery = `SELECT COUNT(*) as row_count FROM (SELECT 1 FROM "${table.schemaname}"."${table.tablename}" LIMIT 100000) t`;
            }
            const countResult = await client.query(countQuery);
            return {
              ...table,
              row_count: parseInt(countResult.rows[0].row_count || 0),
            };
          } catch (error) {
            // Ako ne možemo da dobijemo count, vrati null
            this.logger.warn(`Could not get row count for ${table.schemaname}.${table.tablename}: ${error.message}`);
            return {
              ...table,
              row_count: null,
            };
          }
        })
      );

      // Dodatne informacije za hypertables (samo public schema) sa detaljima o veličini
      const hypertablesQuery = `
        SELECT 
          h.hypertable_schema,
          h.hypertable_name,
          h.owner,
          h.num_dimensions,
          h.num_chunks,
          h.compression_enabled,
          h.tablespaces,
          pg_size_pretty(hypertable_size(format('%I.%I', h.hypertable_schema, h.hypertable_name)::regclass)) as total_size,
          pg_size_pretty(hypertable_index_size(format('%I.%I', h.hypertable_schema, h.hypertable_name)::regclass)) as index_size
        FROM timescaledb_information.hypertables h
        WHERE h.hypertable_schema = 'public';
      `;
      
      const hypertablesResult = await client.query(hypertablesQuery);
      
      // Spoji informacije
      const enrichedTables = tablesWithRowCount.map(table => {
        const hypertableInfo = hypertablesResult.rows.find(
          h => h.hypertable_schema === table.schemaname && h.hypertable_name === table.tablename
        );
        
        return {
          ...table,
          hypertable_info: hypertableInfo || null,
        };
      });

      return enrichedTables;
    } catch (error) {
      this.logger.error('Error fetching tables:', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async getContinuousAggregates() {
    const client = await this.getConnection();
    
    try {
      const query = `
        SELECT 
          ca.view_schema,
          ca.view_name,
          ca.materialization_hypertable_schema,
          ca.materialization_hypertable_name,
          ca.view_definition,
          ca.compression_enabled,
          ca.finalized
        FROM timescaledb_information.continuous_aggregates ca
        WHERE ca.view_schema = 'public'
        ORDER BY ca.view_schema, ca.view_name;
      `;

      const result = await client.query(query);

      // Dobavi dodatne informacije za svaki aggregate
      const aggregatesWithInfo = await Promise.all(
        result.rows.map(async (aggregate) => {
          try {
            // Dobavi veličinu materialized view-a koristeći hypertable_size za tačnu veličinu
            // Koristi escape da izbegne SQL injection
            const escapedSchema = aggregate.materialization_hypertable_schema.replace(/"/g, '""');
            const escapedTable = aggregate.materialization_hypertable_name.replace(/"/g, '""');
            const sizeQuery = `
              SELECT pg_size_pretty(
                COALESCE(
                  hypertable_size('"${escapedSchema}"."${escapedTable}"'::regclass),
                  pg_total_relation_size('"${escapedSchema}"."${escapedTable}"'::regclass)
                )
              ) as size
            `;
            const sizeResult = await client.query(sizeQuery);

            // Dobavi broj redova
            const countQuery = `SELECT COUNT(*) as row_count FROM "${aggregate.view_schema}"."${aggregate.view_name}"`;
            const countResult = await client.query(countQuery);

            // Dobavi refresh policy ako postoji
            const policyQuery = `
              SELECT 
                j.schedule_interval::text as refresh_interval,
                j.config->>'start_offset' as start_offset,
                j.config->>'end_offset' as end_offset,
                js.next_start as next_run,
                js.last_successful_finish as last_run,
                CASE 
                  WHEN js.last_successful_finish IS NOT NULL THEN 'Success'
                  ELSE 'Failed'
                END as last_status
              FROM timescaledb_information.jobs j
              LEFT JOIN timescaledb_information.job_stats js ON js.job_id = j.job_id
              WHERE j.proc_name = 'policy_refresh_continuous_aggregate'
              AND j.hypertable_name = $1
            `;
            const policyResult = await client.query(policyQuery, [aggregate.view_name]);

            return {
              ...aggregate,
              size: sizeResult.rows[0]?.size || 'N/A',
              row_count: parseInt(countResult.rows[0]?.row_count || 0),
              refresh_policy: policyResult.rows[0] || null,
            };
          } catch (error) {
            this.logger.warn(`Could not get details for aggregate ${aggregate.view_schema}.${aggregate.view_name}: ${error.message}`);
            this.logger.debug(`Error details:`, error);
            return {
              ...aggregate,
              size: 'N/A',
              row_count: null,
              refresh_policy: null,
            };
          }
        })
      );

      return aggregatesWithInfo;
    } catch (error) {
      this.logger.error('Error fetching continuous aggregates:', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async getTableStatistics(schemaName: string, tableName: string) {
    const client = await this.getConnection();
    
    try {
      const query = `
        SELECT 
          schemaname,
          tablename,
          n_live_tup as live_rows,
          n_dead_tup as dead_rows,
          n_mod_since_analyze as modifications_since_analyze,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze,
          vacuum_count,
          autovacuum_count,
          analyze_count,
          autoanalyze_count
        FROM pg_stat_user_tables
        WHERE schemaname = $1 AND tablename = $2;
      `;

      const result = await client.query(query, [schemaName, tableName]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error(`Error fetching statistics for ${schemaName}.${tableName}:`, error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async refreshContinuousAggregate(
    aggregateName: string, 
    startTime?: string, 
    endTime?: string
  ) {
    const client = await this.getConnection();
    
    try {
      // Escapujemo ime agregata da izbegnemo SQL injection
      const escapedAggregateName = aggregateName.replace(/"/g, '""');
      let query: string;
      let params: any[] = [];
      
      if (startTime && endTime) {
        // Refresh sa specifičnim periodom
        query = `CALL refresh_continuous_aggregate('"public"."${escapedAggregateName}"', $1::timestamp, $2::timestamp);`;
        params = [startTime, endTime];
        
        this.logger.log(`Refreshing aggregate ${aggregateName} from ${startTime} to ${endTime}`);
      } else if (startTime) {
        // Refresh od startTime do sada
        query = `CALL refresh_continuous_aggregate('"public"."${escapedAggregateName}"', $1::timestamp, NOW());`;
        params = [startTime];
        
        this.logger.log(`Refreshing aggregate ${aggregateName} from ${startTime} to NOW`);
      } else {
        // Potpun refresh - NULL znači ceo opseg
        query = `CALL refresh_continuous_aggregate('"public"."${escapedAggregateName}"', NULL, NULL);`;
        params = [];
        
        this.logger.log(`Performing full refresh of aggregate ${aggregateName}`);
      }
      
      await client.query(query, params);
      
      // Dobavi informacije o agregatu nakon refresh-a  
      const infoQuery = `
        SELECT 
          ca.view_name,
          pg_size_pretty(
            hypertable_size(format('%I.%I', ca.materialization_hypertable_schema, 
                                           ca.materialization_hypertable_name)::regclass)
          ) as size,
          NOW() as refreshed_at
        FROM timescaledb_information.continuous_aggregates ca
        WHERE ca.view_schema = 'public' AND ca.view_name = $1
      `;
      
      const infoResult = await client.query(infoQuery, [aggregateName]);
      
      // Dobavi broj redova odvojeno
      const countQuery = `SELECT COUNT(*) as row_count FROM "public"."${escapedAggregateName}"`;
      const countResult = await client.query(countQuery);
      
      return {
        success: true,
        message: `Continuous aggregate ${aggregateName} uspešno osvežen`,
        details: {
          aggregate: aggregateName,
          startTime: startTime || 'početak',
          endTime: endTime || 'trenutni moment',
          ...infoResult.rows[0]
        }
      };
    } catch (error) {
      this.logger.error(`Error refreshing aggregate ${aggregateName}:`, error);
      
      // Proveri da li aggregate postoji
      if (error.message?.includes('does not exist')) {
        throw new Error(`Continuous aggregate ${aggregateName} ne postoji`);
      }
      
      throw new Error(`Greška pri osvežavanju agregata: ${error.message}`);
    } finally {
      await client.end();
    }
  }
}