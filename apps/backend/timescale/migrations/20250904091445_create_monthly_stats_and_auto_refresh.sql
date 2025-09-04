-- ====================================================================
-- Kreiranje monthly_vehicle_raw_stats i automatska refresh politika
-- ====================================================================
-- Datum: 04.09.2025
-- Problem: LIVE server nema monthly_vehicle_raw_stats i automatsko osvežavanje
-- Rešenje: Kreira continuous aggregate + automatsku refresh politiku
-- ====================================================================

-- migrate:up

RAISE NOTICE 'Kreiram monthly_vehicle_raw_stats continuous aggregate...';

-- 1. Kreiraj monthly_vehicle_raw_stats continuous aggregate
-- (isto kao na lokalnoj bazi - čita iz driving_events)
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_vehicle_raw_stats
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 mon'::interval, time) AS month,
    vehicle_id,
    COUNT(*)::integer AS total_events
FROM driving_events
GROUP BY time_bucket('1 mon'::interval, time), vehicle_id
WITH NO DATA;

RAISE NOTICE '✅ monthly_vehicle_raw_stats continuous aggregate kreiran';

-- 2. Dodaj automatsku refresh politiku za monthly_vehicle_raw_stats
-- Osvežava svaki sat, gleda 3 meseca unazad
RAISE NOTICE 'Dodajem automatsku refresh politiku...';

SELECT add_continuous_aggregate_policy(
    'monthly_vehicle_raw_stats',
    start_offset => INTERVAL '3 months',
    end_offset => INTERVAL '1 hour', 
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => true
);

RAISE NOTICE '✅ Automatska refresh politika dodana';

-- 3. Inicijalni refresh da popuni podatke
RAISE NOTICE 'Pokrećem inicijalni refresh za poslednja 3 meseca...';

CALL refresh_continuous_aggregate(
    'monthly_vehicle_raw_stats',
    CURRENT_DATE - INTERVAL '3 months',
    NULL
);

RAISE NOTICE '✅ Inicijalni refresh završen';

-- 4. Proveri da li je sve uspešno kreirano
DO $$
DECLARE
    job_count INTEGER;
    aggregate_count INTEGER;
    policy_count INTEGER;
BEGIN
    -- Proveri continuous aggregate
    SELECT COUNT(*) INTO aggregate_count 
    FROM timescaledb_information.continuous_aggregates 
    WHERE view_name = 'monthly_vehicle_raw_stats';
    
    -- Proveri refresh politiku
    SELECT COUNT(*) INTO policy_count 
    FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_refresh_continuous_aggregate'
      AND config::text LIKE '%monthly_vehicle_raw_stats%';
    
    -- Ukupno job-ova
    SELECT COUNT(*) INTO job_count 
    FROM timescaledb_information.jobs;
    
    RAISE NOTICE '📊 REZULTAT MIGRACIJE:';
    RAISE NOTICE '   - monthly_vehicle_raw_stats created: %', 
        CASE WHEN aggregate_count > 0 THEN 'YES' ELSE 'NO' END;
    RAISE NOTICE '   - Automatska refresh politika: %', 
        CASE WHEN policy_count > 0 THEN 'YES' ELSE 'NO' END;
    RAISE NOTICE '   - Ukupno TimescaleDB jobs: %', job_count;
    
    -- Proveri da li imamo podatke
    SELECT COUNT(*) INTO aggregate_count FROM monthly_vehicle_raw_stats;
    RAISE NOTICE '   - Monthly stats records: %', aggregate_count;
END $$;

RAISE NOTICE '🚀 monthly_vehicle_raw_stats sa automatskim refresh-om spreman!';

-- migrate:down

RAISE NOTICE 'Rollback: Brisanje monthly_vehicle_raw_stats...';

-- 1. Ukloni automatsku refresh politiku
DO $$
DECLARE
    job_record RECORD;
BEGIN
    FOR job_record IN 
        SELECT job_id 
        FROM timescaledb_information.jobs 
        WHERE proc_name = 'policy_refresh_continuous_aggregate'
          AND config::text LIKE '%monthly_vehicle_raw_stats%'
    LOOP
        PERFORM remove_job(job_record.job_id);
        RAISE NOTICE 'Uklonjen job ID: %', job_record.job_id;
    END LOOP;
END $$;

-- 2. Obriši continuous aggregate
DROP MATERIALIZED VIEW IF EXISTS monthly_vehicle_raw_stats;

RAISE NOTICE '✅ monthly_vehicle_raw_stats uklonjen';