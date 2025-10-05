import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Client } from 'pg';

@Injectable()
export class TimescaledbService {
  private readonly logger = new Logger(TimescaledbService.name);
  private activeRefreshes = new Map<
    string,
    { startTime: Date; estimatedDuration?: number }
  >();

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
            this.logger.warn(
              `Could not get row count for ${table.schemaname}.${table.tablename}: ${error.message}`,
            );
            return {
              ...table,
              row_count: null,
            };
          }
        }),
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
      const enrichedTables = tablesWithRowCount.map((table) => {
        const hypertableInfo = hypertablesResult.rows.find(
          (h) =>
            h.hypertable_schema === table.schemaname &&
            h.hypertable_name === table.tablename,
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
            const escapedSchema =
              aggregate.materialization_hypertable_schema.replace(/"/g, '""');
            const escapedTable =
              aggregate.materialization_hypertable_name.replace(/"/g, '""');
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
            const policyResult = await client.query(policyQuery, [
              aggregate.view_name,
            ]);

            return {
              ...aggregate,
              size: sizeResult.rows[0]?.size || 'N/A',
              row_count: parseInt(countResult.rows[0]?.row_count || 0),
              refresh_policy: policyResult.rows[0] || null,
            };
          } catch (error) {
            this.logger.warn(
              `Could not get details for aggregate ${aggregate.view_schema}.${aggregate.view_name}: ${error.message}`,
            );
            this.logger.debug(`Error details:`, error);
            return {
              ...aggregate,
              size: 'N/A',
              row_count: null,
              refresh_policy: null,
            };
          }
        }),
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
      this.logger.error(
        `Error fetching statistics for ${schemaName}.${tableName}:`,
        error,
      );
      throw error;
    } finally {
      await client.end();
    }
  }

  async refreshContinuousAggregate(
    aggregateName: string,
    startTime?: string,
    endTime?: string,
  ) {
    const client = await this.getConnection();

    try {
      // Escapujemo ime agregata da izbegnemo SQL injection
      const escapedAggregateName = aggregateName.replace(/"/g, '""');

      // Za velike aggregate, koristi async refresh preko TimescaleDB background worker-a
      // Ovo će pokrenuti refresh u pozadini i odmah vratiti rezultat

      if (
        aggregateName === 'daily_vehicle_stats' ||
        aggregateName === 'hourly_vehicle_stats' ||
        aggregateName === 'vehicle_hourly_stats' ||
        aggregateName === 'monthly_vehicle_raw_stats'
      ) {
        // Za velike aggregate, pokreni u pozadini
        this.logger.log(
          `Starting background refresh for large aggregate: ${aggregateName}`,
        );

        // refresh_continuous_aggregate ne može da radi u transakciji
        // Postavimo duži timeout za velike aggregate sa složenim PostGIS funkcijama
        try {
          // Postavi timeout na 60 minuta za full refresh (posebno za gps_data_5_minute_no_lag_aggregate)
          const timeoutMs = 3600000; // 60 minuta
          await client.query(`SET statement_timeout = ${timeoutMs}`);

          // Zatim pokušaj refresh (ovo će timeout-ovati za velike aggregate)
          try {
            // Koristi prosleđene datume ako postoje
            let refreshQuery: string;
            let refreshParams: any[] = [];

            if (startTime && endTime) {
              refreshQuery = `CALL refresh_continuous_aggregate('"public"."${escapedAggregateName}"', $1::timestamp, $2::timestamp);`;
              refreshParams = [startTime, endTime];
              this.logger.log(
                `Attempting quick refresh for ${aggregateName} from ${startTime} to ${endTime}`,
              );
            } else if (startTime) {
              refreshQuery = `CALL refresh_continuous_aggregate('"public"."${escapedAggregateName}"', $1::timestamp, NULL);`;
              refreshParams = [startTime];
              this.logger.log(
                `Attempting quick refresh for ${aggregateName} from ${startTime}`,
              );
            } else {
              refreshQuery = `CALL refresh_continuous_aggregate('"public"."${escapedAggregateName}"', NULL, NULL);`;
              refreshParams = [];
              this.logger.log(
                `Attempting full quick refresh for ${aggregateName}`,
              );
            }

            await client.query(refreshQuery, refreshParams);
            // Ako je završio brzo, super
            this.logger.log(`Quick refresh completed for ${aggregateName}`);
          } catch (timeoutErr: any) {
            if (
              timeoutErr.message?.includes(
                'canceling statement due to statement timeout',
              ) ||
              timeoutErr.message?.includes('statement timeout')
            ) {
              // Ovo je očekivano - refresh još traje u pozadini
              this.logger.log(
                `Background refresh started for ${aggregateName} (continuing in background)`,
              );
            } else {
              throw timeoutErr;
            }
          } finally {
            // Resetuj timeout
            await client.query('RESET statement_timeout');
          }

          // Vrati uspešan response
          return {
            success: true,
            message: `Osvežavanje agregata "${aggregateName}" je pokrenuto. Zbog velikog broja podataka i složenih PostGIS kalkulacija, proces može trajati 15-60 minuta za full refresh.`,
            details: {
              aggregate: aggregateName,
              status: 'running_in_background',
              note: 'Možete nastaviti sa radom. Tabela će biti automatski ažurirana kada se refresh završi. Za brži refresh, koristite inkrementalni refresh sa vremenskim opsegom.',
            },
          };
        } catch (err: any) {
          this.logger.warn(
            `Could not start background refresh: ${err.message}`,
          );
          // Nastavi sa običnim refresh
        }
      }

      // Za manje aggregate ili ako background job ne radi, koristi običan refresh
      let query: string;
      let params: any[] = [];

      if (startTime && endTime) {
        query = `CALL refresh_continuous_aggregate('"public"."${escapedAggregateName}"', $1::timestamp, $2::timestamp);`;
        params = [startTime, endTime];
        this.logger.log(
          `Refreshing aggregate ${aggregateName} from ${startTime} to ${endTime}`,
        );
      } else if (startTime) {
        query = `CALL refresh_continuous_aggregate('"public"."${escapedAggregateName}"', $1::timestamp, NOW());`;
        params = [startTime];
        this.logger.log(
          `Refreshing aggregate ${aggregateName} from ${startTime} to NOW`,
        );
      } else {
        query = `CALL refresh_continuous_aggregate('"public"."${escapedAggregateName}"', NULL, NULL);`;
        params = [];
        this.logger.log(
          `Performing full refresh of aggregate ${aggregateName}`,
        );
      }

      // Postavi timeout na 5 minuta za sve aggregate
      await client.query('SET statement_timeout = 300000');

      try {
        await client.query(query, params);
      } finally {
        await client.query('RESET statement_timeout');
      }

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
          ...infoResult.rows[0],
        },
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

  async getContinuousAggregatesStatus() {
    const client = await this.getConnection();

    try {
      // Dobavi trenutne refresh procese - poboljšan query
      const activeRefreshQuery = `
        SELECT 
          pid,
          state,
          query_start,
          now() - query_start as duration,
          CASE 
            WHEN query LIKE '%daily_vehicle_stats%' THEN 'daily_vehicle_stats'
            WHEN query LIKE '%vehicle_hourly_stats%' THEN 'vehicle_hourly_stats'
            WHEN query LIKE '%monthly_vehicle_raw_stats%' THEN 'monthly_vehicle_raw_stats'
            WHEN query LIKE '%"public"."daily_vehicle_stats"%' THEN 'daily_vehicle_stats'
            WHEN query LIKE '%"public"."vehicle_hourly_stats"%' THEN 'vehicle_hourly_stats'
            WHEN query LIKE '%"public"."monthly_vehicle_raw_stats"%' THEN 'monthly_vehicle_raw_stats'
            ELSE regexp_replace(query, '.*"([^"]+)".*', '\\1')
          END as aggregate_name,
          query
        FROM pg_stat_activity 
        WHERE (
          query LIKE '%refresh_continuous_aggregate%' 
          OR query LIKE '%CALL refresh_continuous_aggregate%'
          OR query LIKE '%INSERT INTO%_timescaledb_internal%'
          OR query LIKE '%materialized_hypertable%'
        )
        AND state IN ('active', 'idle in transaction')
        AND pid != pg_backend_pid()
        AND query NOT LIKE '%pg_stat_activity%'
        ORDER BY query_start DESC;
      `;

      const activeRefreshes = await client.query(activeRefreshQuery);

      // Dobavi statistike o agregatima
      const aggregateStatsQuery = `
        SELECT 
          ca.view_name,
          ca.view_schema,
          -- Poslednji refresh iz job history
          (SELECT MAX(last_successful_finish) 
           FROM timescaledb_information.job_stats js
           JOIN timescaledb_information.jobs j ON j.job_id = js.job_id
           WHERE j.hypertable_name = ca.view_name) as last_refresh,
          -- Sledeći scheduled refresh
          (SELECT MIN(next_start) 
           FROM timescaledb_information.job_stats js
           JOIN timescaledb_information.jobs j ON j.job_id = js.job_id
           WHERE j.hypertable_name = ca.view_name) as next_refresh,
          -- Broj redova
          NULL as row_count,
          -- Poslednji datum u agregatu
          CASE 
            WHEN ca.view_name = 'daily_vehicle_stats' THEN 
              (SELECT MAX(day) FROM daily_vehicle_stats)::text
            WHEN ca.view_name = 'vehicle_hourly_stats' THEN
              (SELECT MAX(hour) FROM vehicle_hourly_stats)::text
            WHEN ca.view_name = 'monthly_vehicle_raw_stats' THEN
              (SELECT MAX(month) FROM monthly_vehicle_raw_stats)::text
            ELSE NULL
          END as last_data_point,
          -- Veličina
          pg_size_pretty(
            hypertable_size(format('%I.%I', ca.materialization_hypertable_schema, 
                                          ca.materialization_hypertable_name)::regclass)
          ) as size
        FROM timescaledb_information.continuous_aggregates ca
        WHERE ca.view_schema = 'public';
      `;

      // Note: Ova query neće raditi zbog dinamičkog SQL-a
      // Moramo je pojednostaviti
      const simpleStatsQuery = `
        WITH aggregate_info AS (
          SELECT 
            ca.view_name,
            ca.view_schema,
            ca.materialization_hypertable_schema,
            ca.materialization_hypertable_name
          FROM timescaledb_information.continuous_aggregates ca
          WHERE ca.view_schema = 'public'
        )
        SELECT 
          ai.view_name,
          ai.view_schema,
          -- Job info
          j.job_id,
          js.last_successful_finish as last_refresh,
          js.next_start as next_refresh,
          js.total_runs,
          js.total_successes,
          js.total_failures,
          -- Veličina
          pg_size_pretty(
            hypertable_size(format('%I.%I', ai.materialization_hypertable_schema, 
                                          ai.materialization_hypertable_name)::regclass)
          ) as size
        FROM aggregate_info ai
        LEFT JOIN timescaledb_information.jobs j 
          ON j.hypertable_name = ai.view_name 
          AND j.proc_name = 'policy_refresh_continuous_aggregate'
        LEFT JOIN timescaledb_information.job_stats js 
          ON js.job_id = j.job_id
        ORDER BY ai.view_name;
      `;

      const aggregateStats = await client.query(simpleStatsQuery);

      // Za svaki agregat, dobavi dodatne informacije
      const enrichedStats = await Promise.all(
        aggregateStats.rows.map(async (agg) => {
          let lastDataPoint = null;
          let rowCount: number | null = null;

          try {
            // Dobavi poslednji datum
            if (agg.view_name === 'daily_vehicle_stats') {
              const result = await client.query(
                'SELECT MAX(day)::text as last_date FROM daily_vehicle_stats',
              );
              lastDataPoint = result.rows[0]?.last_date;
            } else if (agg.view_name === 'vehicle_hourly_stats') {
              const result = await client.query(
                'SELECT MAX(hour)::text as last_date FROM vehicle_hourly_stats',
              );
              lastDataPoint = result.rows[0]?.last_date;
            } else if (agg.view_name === 'monthly_vehicle_raw_stats') {
              const result = await client.query(
                'SELECT MAX(month)::text as last_date FROM monthly_vehicle_raw_stats',
              );
              lastDataPoint = result.rows[0]?.last_date;
            }

            // Dobavi broj redova (sa limitom za performanse)
            const countQuery = `SELECT COUNT(*) as cnt FROM public."${agg.view_name}" LIMIT 1`;
            const countResult = await client.query(countQuery);
            rowCount = parseInt(countResult.rows[0]?.cnt || 0);
          } catch (err) {
            this.logger.warn(
              `Could not get details for ${agg.view_name}: ${err.message}`,
            );
          }

          return {
            ...agg,
            last_data_point: lastDataPoint,
            row_count: rowCount,
            is_refreshing: activeRefreshes.rows.some((r) =>
              r.query?.includes(agg.view_name),
            ),
            active_refresh: activeRefreshes.rows.find((r) =>
              r.query?.includes(agg.view_name),
            ),
          };
        }),
      );

      return {
        aggregates: enrichedStats,
        active_refreshes: activeRefreshes.rows,
        summary: {
          total_aggregates: enrichedStats.length,
          currently_refreshing: activeRefreshes.rows.length,
          last_checked: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Error getting aggregates status:', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async getTimescaleJobs() {
    const client = await this.getConnection();

    try {
      const query = `
        SELECT 
          j.job_id,
          j.application_name,
          j.proc_name,
          j.hypertable_name,
          j.hypertable_schema,
          j.schedule_interval,
          js.next_start,
          js.last_successful_finish,
          js.last_run_duration,
          js.total_runs,
          js.total_successes,
          js.total_failures,
          js.last_run_status,
          -- Job config
          j.config
        FROM timescaledb_information.jobs j
        LEFT JOIN timescaledb_information.job_stats js ON js.job_id = j.job_id
        WHERE j.proc_name LIKE '%refresh%' OR j.proc_name LIKE '%compress%'
        ORDER BY js.next_start ASC;
      `;

      const jobs = await client.query(query);

      // Vraćamo samo jobs za sada
      return jobs.rows;
    } catch (error) {
      this.logger.error('Error getting TimescaleDB jobs:', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async resetContinuousAggregate(aggregateName: string) {
    const client = await this.getConnection();

    try {
      this.logger.log(
        `Početak RESET procesa za continuous aggregate: ${aggregateName}`,
      );

      // Korak 1: Dobavi sve informacije o agregatu PRE brisanja
      const aggregateInfoQuery = `
        SELECT 
          ca.view_name,
          ca.view_definition,
          ca.materialization_hypertable_schema,
          ca.materialization_hypertable_name
        FROM timescaledb_information.continuous_aggregates ca
        WHERE ca.view_name = $1
      `;

      const aggregateInfo = await client.query(aggregateInfoQuery, [
        aggregateName,
      ]);

      if (aggregateInfo.rows.length === 0) {
        throw new Error(`Continuous aggregate "${aggregateName}" ne postoji`);
      }

      const { view_definition } = aggregateInfo.rows[0];

      // VAŽNO: Sačuvaj originalnu definiciju jer će biti obrisana sa DROP
      this.logger.log(`Sačuvana definicija agregata: ${aggregateName}`);

      // Korak 2: Dobavi refresh politiku ako postoji
      const policyQuery = `
        SELECT 
          j.schedule_interval,
          j.config->>'start_offset' as start_offset,
          j.config->>'end_offset' as end_offset,
          j.job_id
        FROM timescaledb_information.jobs j
        WHERE j.proc_name = 'policy_refresh_continuous_aggregate'
        AND j.config::jsonb @> jsonb_build_object('mat_hypertable_id', 
          (SELECT ht.id::text
           FROM _timescaledb_catalog.hypertable ht
           WHERE ht.schema_name = '_timescaledb_internal'
           AND ht.table_name = (
             SELECT ca.materialization_hypertable_name
             FROM timescaledb_information.continuous_aggregates ca
             WHERE ca.view_name = $1
           ))
        )
      `;

      const policyInfo = await client.query(policyQuery, [aggregateName]);
      const hasPolicy = policyInfo.rows.length > 0;
      let policyConfig: {
        schedule_interval: string;
        start_offset: string;
        end_offset: string;
      } | null = null;

      if (hasPolicy) {
        policyConfig = {
          schedule_interval: policyInfo.rows[0].schedule_interval,
          start_offset: policyInfo.rows[0].start_offset,
          end_offset: policyInfo.rows[0].end_offset,
        };
        this.logger.log(
          `Pronađena refresh politika: ${JSON.stringify(policyConfig)}`,
        );
      } else {
        this.logger.warn(
          `Nema postojeće refresh politike za ${aggregateName} - koristićemo default vrednosti`,
        );
        // Default policy vrednosti ako ne postoji
        policyConfig = {
          schedule_interval: '01:00:00', // svakih sat vremena
          start_offset: '30 days', // poslednih 30 dana
          end_offset: '1 hour', // do pre 1 sat
        };
      }

      // Korak 3: DROP postojeći agregat (ovo automatski briše i politike)
      this.logger.log(`Brisanje postojećeg agregata: ${aggregateName}`);
      await client.query(
        `DROP MATERIALIZED VIEW IF EXISTS ${aggregateName} CASCADE`,
      );

      // Korak 4: Recreate agregat sa istom definicijom ali praznom (WITH NO DATA)
      this.logger.log(`Ponovno kreiranje agregata: ${aggregateName}`);

      // view_definition već sadrži kompletan SELECT sa GROUP BY
      // Moramo da uklonimo trailing semicolon ako postoji
      const cleanedViewDef = view_definition.replace(/;\s*$/, '');

      const createQuery = `
        CREATE MATERIALIZED VIEW ${aggregateName}
        WITH (timescaledb.continuous) AS
        ${cleanedViewDef}
        WITH NO DATA
      `;

      await client.query(createQuery);

      // Korak 5: UVEK dodaj refresh politiku (postojeću ili default)
      if (policyConfig) {
        this.logger.log(
          `Dodavanje refresh politike za ${aggregateName}: ${JSON.stringify(policyConfig)}`,
        );
        const addPolicyQuery = `
          SELECT add_continuous_aggregate_policy(
            $1,
            start_offset => $2::interval,
            end_offset => $3::interval,
            schedule_interval => $4::interval,
            if_not_exists => true
          )
        `;

        try {
          const result = await client.query(addPolicyQuery, [
            aggregateName,
            policyConfig.start_offset,
            policyConfig.end_offset,
            policyConfig.schedule_interval,
          ]);
          this.logger.log(
            `Refresh politika uspešno dodata. Job ID: ${result.rows[0]?.add_continuous_aggregate_policy}`,
          );
        } catch (policyError: any) {
          this.logger.error(
            `Greška pri dodavanju refresh politike: ${policyError.message}`,
          );
          // Ne prekidamo proces ako policy ne uspe
        }
      }

      // Korak 6: Proveri da je agregat prazan
      const countQuery = `
        SELECT COUNT(*) as count FROM ${aggregateName}
      `;
      const countResult = await client.query(countQuery);
      const rowCount = parseInt(countResult.rows[0].count);

      if (rowCount > 0) {
        throw new Error(
          `Reset nije potpuno uspeo - agregat još uvek ima ${rowCount} redova`,
        );
      }

      this.logger.log(`RESET uspešno završen za agregat: ${aggregateName}`);

      return {
        success: true,
        message: `Continuous aggregate "${aggregateName}" je uspešno resetovan`,
        details: {
          aggregate: aggregateName,
          status: 'reset_completed',
          rowsAfterReset: 0,
          policyRestored: true, // Uvek pokušavamo da vratimo policy
          hadPreviousPolicy: hasPolicy,
          policyConfig: policyConfig,
          nextStep:
            'Agregat je sada prazan. Koristite Refresh dugme da ponovo popunite podatke ili sačekajte automatski refresh.',
        },
      };
    } catch (error: any) {
      this.logger.error(`Greška pri RESET agregata ${aggregateName}:`, error);

      // Proveri specifične greške
      if (error.message?.includes('ne postoji')) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException(
        `Greška pri resetovanju agregata: ${error.message || 'Nepoznata greška'}`,
      );
    } finally {
      await client.end();
    }
  }
}
