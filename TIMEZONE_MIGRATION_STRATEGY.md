# 🚨 STRATEGIJA MIGRACIJE TIMEZONE PODATAKA - GPS TimescaleDB

**Datum:** 16.09.2025
**Obim:** ~304 MILIONA zapisa
**Problem:** Svi postojeći GPS podaci su pomereni za +2 sata
**Cilj:** Ispraviti timezone bez downtime-a

## 📊 Analiza situacije

### Obim podataka
- **Total zapisa:** ~304,086,872
- **Period:** 3 meseca (jun-septembar 2025)
- **Vozila:** ~1000
- **Prosečno po vozilu:** ~300,000 zapisa
- **Prosečno po danu:** ~3.3 miliona zapisa

### Problemi sa direktnim UPDATE
1. **Vreme izvršavanja:** 5-10 sati minimum
2. **Table lock:** Blokira nove inserte
3. **Transaction log:** Ogroman ROLLBACK segment
4. **Kontinuirani agregati:** Moraju se refresh-ovati
5. **Downtime:** Neprihvatljiv za live sistem

## ✅ PREPORUČENA STRATEGIJA: Inkrementalni pristup sa SWAP

### Faza 1: Priprema (BEZ downtime)

```sql
-- 1. Kreiraj novu tabelu sa ispravnim podacima
CREATE TABLE gps_data_fixed (LIKE gps_data INCLUDING ALL);

-- 2. Konvertuj je u hypertable
SELECT create_hypertable('gps_data_fixed', 'time',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE);

-- 3. Dodaj indekse
CREATE INDEX ON gps_data_fixed (vehicle_id, time DESC);
CREATE INDEX ON gps_data_fixed (time DESC, vehicle_id);
CREATE INDEX ON gps_data_fixed USING GIST (location);
```

### Faza 2: Batch migracija (BEZ downtime)

```sql
-- Migriraj podatke po danima (najstariji prvo)
DO $$
DECLARE
  start_date DATE := '2025-06-16';
  end_date DATE := CURRENT_DATE;
  current_date DATE;
  batch_count INTEGER;
BEGIN
  current_date := start_date;

  WHILE current_date <= end_date LOOP
    -- Migriraj jedan dan
    INSERT INTO gps_data_fixed
    SELECT
      time - INTERVAL '2 hours' as time,  -- ISPRAVKA TIMEZONE
      vehicle_id,
      garage_no,
      lat,
      lng,
      location,
      speed,
      course,
      alt,
      state,
      in_route,
      line_number,
      departure_id,
      people_in,
      people_out,
      data_source
    FROM gps_data
    WHERE time >= current_date
      AND time < current_date + INTERVAL '1 day';

    GET DIAGNOSTICS batch_count = ROW_COUNT;

    -- Log progress
    RAISE NOTICE 'Migrated % for date %', batch_count, current_date;

    -- Pauza između batch-ova da ne optereti sistem
    PERFORM pg_sleep(1);

    current_date := current_date + INTERVAL '1 day';
  END LOOP;
END $$;
```

### Faza 3: Dual-write period (1-2 dana)

```typescript
// U GpsProcessorService - piši u OBE tabele
async insertBatchToTimescale(points: any[]) {
  // Postojeća tabela (sa ispravkom)
  await this.timescalePool.query(insertQuery, values);

  // Nova tabela (već ispravna)
  await this.timescalePool.query(insertQueryFixed, values);
}
```

### Faza 4: Atomic SWAP (kratki downtime ~30 sekundi)

```sql
BEGIN;

-- 1. Zaustavi aplikaciju (30 sekundi downtime počinje)

-- 2. Migriraj poslednje podatke
INSERT INTO gps_data_fixed
SELECT ... FROM gps_data
WHERE time > (SELECT MAX(time) FROM gps_data_fixed);

-- 3. Preimenuj tabele
ALTER TABLE gps_data RENAME TO gps_data_old;
ALTER TABLE gps_data_fixed RENAME TO gps_data;

-- 4. Rekreiraj continuous agregates
DROP MATERIALIZED VIEW IF EXISTS vehicle_hourly_stats CASCADE;
CREATE MATERIALIZED VIEW vehicle_hourly_stats
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS hour,
  vehicle_id,
  COUNT(*) as point_count,
  AVG(speed) as avg_speed,
  MAX(speed) as max_speed,
  SUM(
    ST_Distance(
      location::geography,
      LAG(location::geography) OVER (PARTITION BY vehicle_id ORDER BY time)
    ) / 1000
  ) as distance_km
FROM gps_data
GROUP BY hour, vehicle_id
WITH NO DATA;

-- 5. Pokreni refresh
SELECT add_continuous_aggregate_policy('vehicle_hourly_stats',
  start_offset => INTERVAL '3 months',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '30 minutes');

COMMIT;

-- 6. Restartuj aplikaciju (downtime završen)
```

### Faza 5: Cleanup

```sql
-- Posle verifikacije da sve radi
DROP TABLE gps_data_old;

-- Oslobodi prostor
VACUUM FULL ANALYZE gps_data;
```

## 🎯 ALTERNATIVA: Koristi TimescaleDB Background Jobs

```sql
-- Kreiraj background job za migraciju
CREATE OR REPLACE PROCEDURE migrate_gps_timezone_batch(job_id INT, config JSONB)
LANGUAGE plpgsql AS $$
DECLARE
  batch_size INT := 100000;
  rows_updated INT;
BEGIN
  -- Update batch podataka
  UPDATE gps_data
  SET time = time - INTERVAL '2 hours'
  WHERE time IN (
    SELECT time FROM gps_data
    WHERE time > NOW() - INTERVAL '2 hours'  -- Samo stari podaci
    ORDER BY time ASC
    LIMIT batch_size
  );

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  -- Log progress
  RAISE NOTICE 'Updated % rows', rows_updated;

  -- Ako ima još podataka, nastavi
  IF rows_updated > 0 THEN
    PERFORM add_job('migrate_gps_timezone_batch',
      schedule_interval => INTERVAL '1 minute');
  END IF;
END $$;

-- Pokreni job
SELECT add_job('migrate_gps_timezone_batch',
  schedule_interval => INTERVAL '1 minute',
  config => '{"batch_size": 100000}');
```

## 📋 PROCENA VREMENA

### Opcija 1: SWAP pristup
- **Priprema:** 1 sat
- **Migracija:** 24-48 sati (background)
- **Downtime:** 30 sekundi
- **Cleanup:** 2 sata

### Opcija 2: Background jobs
- **Priprema:** 30 minuta
- **Migracija:** 48-72 sata
- **Downtime:** 0
- **Rizik:** Kontinuirani agregati mogu biti netačni tokom migracije

## ⚠️ KRITIČNE NAPOMENE

1. **BACKUP je OBAVEZAN** pre početka
2. **Testiraj na staging** sa sample podataka
3. **Monitoring tokom migracije** - CPU, I/O, disk space
4. **Koordinacija sa timom** - svi moraju znati plan
5. **Rollback plan** - kako vratiti ako nešto pođe po zlu

## 🎯 PREPORUČENI PRISTUP

Za 304 miliona zapisa preporučujem **SWAP strategiju** jer:
1. Minimalan downtime (30 sekundi)
2. Mogu se testirati novi podaci pre swap-a
3. Lak rollback (samo vrati staru tabelu)
4. Ne utiče na performanse produkcije tokom migracije

## 📊 MONITORING TOKOM MIGRACIJE

```sql
-- Praćenje progresa
SELECT
  (SELECT COUNT(*) FROM gps_data_fixed) as migrated,
  (SELECT COUNT(*) FROM gps_data) as total,
  ROUND(
    (SELECT COUNT(*) FROM gps_data_fixed)::numeric /
    (SELECT COUNT(*) FROM gps_data)::numeric * 100, 2
  ) as percentage;

-- Provera disk space
SELECT
  pg_size_pretty(pg_relation_size('gps_data')) as original_size,
  pg_size_pretty(pg_relation_size('gps_data_fixed')) as new_size,
  pg_size_pretty(pg_database_size(current_database())) as total_db_size;
```

## 🚀 AKCIONI PLAN

1. **Danas:** Kreirati test skripte
2. **Sutra:** Testirati na staging sa 1 milion zapisa
3. **Sreda:** Refinirati strategiju na osnovu testova
4. **Četvrtak:** Priprema produkcije (backup, monitoring)
5. **Petak noć/Subota:** Izvršiti migraciju
6. **Nedelja:** Verifikacija i cleanup