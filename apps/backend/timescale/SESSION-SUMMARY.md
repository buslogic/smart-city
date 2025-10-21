# GPS Kilometer Calculation - Outlier Filtering Implementation

**Datum:** 2025-10-03
**Status:** ✅ Ready for Production Deployment
**Lokacija:** `/home/kocev/smart-city/apps/backend/timescale`

---

## 📋 Executive Summary

Implementiran **industry-standard HIBRIDNI outlier filter** za GPS tracking system koji eliminiše GPS glitcheve (skokove) pri računanju kilometraže vozila.

### Problem koji smo rešili:
- **Pre:** Vozilo P93597 pokazivalo 73,474 km za septembar (nerealno - 10x više od normalnog)
- **Posle:** 6,462 km za septembar (realno - gradski prevoz)
- **Uzrok:** GPS glitchevi - uređaj alternirao između dve lokacije (4.5km razmak) svake sekunde

### Rešenje:
**HIBRIDNI filter** (inspirisan Geotab, Samsara fleet sistemima):
- **Distance threshold:** 300m između GPS tačaka
- **Speed threshold:** 120 km/h kalkulisana brzina
- **Belgrade timezone metadata** za tačne mesečne izveštaje

---

## 🎯 Šta smo tačno uradili

### 1. Kreirana HIBRIDNA funkcija (PostgreSQL/PostGIS)

**Fajl:** `calculate_distance_hybrid_filter()` u migraciji
**Logika:**
```sql
FOR svaku GPS tačku:
  distance = ST_Distance(current, previous)
  speed = (distance / time_diff) * 3.6  -- km/h

  IF distance <= 300m AND speed <= 120km/h THEN
    -- Validna tačka - dodaj u liniju
    total_distance += distance_from_last_valid_point
  ELSE
    -- Outlier - preskoči (GPS glitch)
  END
```

### 2. Ažurirani TimescaleDB Continuous Aggregates

#### A) `monthly_vehicle_distance`
- **Migracija:** `20251003053137_recreate_monthly_distance_with_outlier_filter.sql`
- **Promene:**
  - ✅ Kreirana funkcija `calculate_distance_hybrid_filter()`
  - ✅ Aggregate koristi HIBRIDNI filter umesto `ST_MakeLine()`
  - ✅ Dodati `year_belgrade`, `month_belgrade` kolone
  - ✅ Refresh policy: svakih 1 sat

#### B) `hourly_vehicle_distance`
- **Migracija:** `20251003124547_recreate_hourly_distance_with_hybrid_filter.sql`
- **Promene:**
  - ✅ Aggregate koristi HIBRIDNI filter
  - ✅ Zadržani postojeći Belgrade metadata kolone
  - ✅ Refresh policy: svakih 15 minuta

### 3. Backend Servis (bez promena)

**Fajl:** `apps/backend/src/gps-analytics/gps-analytics.service.ts`
**Status:** ✅ Već ima Analytics pristup (LAG + ST_MakeLine sa filterom)
**Akcija:** NIJE MENJANO - ostaje kako jeste

---

## 📊 Rezultati Testiranja (Lokalna TimescaleDB)

### Vozilo P93597 - Septembar 2025 (Belgrade timezone):

| Pristup | Kilometraža | Status |
|---------|-------------|--------|
| **Hourly aggregate (Belgrade filter)** | 6,462 km | ✅ Preporučeno |
| **Direktni query (Belgrade DATE)** | 6,474 km | ✅ Referentna |
| **Monthly aggregate (UTC bucket)** | 6,508 km | ⚠️ +2h iz oktobra |
| **Bez filtera (staro)** | 73,474 km | ❌ Sa glitchevima |
| **Speed-based (teoretski)** | 354 km | 📊 Teoretski max |

**Razlika:** 11.4x smanjenje (73,474 → 6,462 km) ✅

---

## 🚀 Deployment Plan - LIVE SERVER

### Pre-deployment Checklist:

- [ ] Commit promene na GitHub
- [ ] Push na main branch
- [ ] Pull na live serveru
- [ ] Backup TimescaleDB podataka (opciono - aggregati se mogu re-generisati)

### Deployment Steps:

#### 1. SSH na live server
```bash
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@157.230.119.11
cd /path/to/smart-city/apps/backend
```

#### 2. Pull latest changes
```bash
git pull origin main
```

#### 3. Navigacija u timescale direktorijum
```bash
cd timescale
```

#### 4. Proveri status migracija
```bash
export PATH=$PATH:~/bin
dbmate --migrations-dir ./migrations status
```

**Očekivani output:**
```
[ ] 20251003053137_recreate_monthly_distance_with_outlier_filter.sql
[ ] 20251003124547_recreate_hourly_distance_with_hybrid_filter.sql
```

#### 5. Primeni migracije (KRITIČNO - PRATI OUTPUT!)
```bash
dbmate --migrations-dir ./migrations up
```

**Šta se dešava:**
1. ✅ Kreira funkciju `calculate_distance_hybrid_filter()`
2. ✅ Drop postojeći `monthly_vehicle_distance` (sa CASCADE - briše policy)
3. ✅ Kreira novi `monthly_vehicle_distance` sa HIBRIDNIM filterom
4. ✅ Dodaje refresh policy (1h)
5. ✅ Drop postojeći `hourly_vehicle_distance`
6. ✅ Kreira novi `hourly_vehicle_distance` sa HIBRIDNIM filterom
7. ✅ Dodaje refresh policy (15min)
8. ✅ Kreira indekse

**Očekivano trajanje:** 5-10 sekundi

#### 6. Refresh aggregata (LONGEST STEP - MONITOR!)

**VAŽNO:** Aggregati su kreirani SA `WITH NO DATA` - moraju se ručno populate-ovati!

```bash
# Uđi u psql na live TimescaleDB
docker run --rm postgres:16 psql 'postgres://tsdbadmin:Buslogic123%21@b96osgyp1w.duvl2ceai2.tsdb.cloud.timescale.com:31143/tsdb?sslmode=require'
```

**U psql terminalu:**

```sql
-- Proveri da li funkcija postoji
\df calculate_distance_hybrid_filter

-- Proveri da li aggregati postoje
SELECT view_name FROM timescaledb_information.continuous_aggregates;

-- Refresh monthly aggregate (MOŽE TRAJATI 2-5 MINUTA!)
CALL refresh_continuous_aggregate('monthly_vehicle_distance', NULL, NULL);

-- Proveri da li ima podataka
SELECT COUNT(*) FROM monthly_vehicle_distance;

-- Refresh hourly aggregate (MOŽE TRAJATI 5-10 MINUTA!)
CALL refresh_continuous_aggregate('hourly_vehicle_distance', NULL, NULL);

-- Proveri da li ima podataka
SELECT COUNT(*) FROM hourly_vehicle_distance;
```

**Praćenje progresa:**

U DRUGOM terminalu (drugi SSH sesija):
```bash
docker run --rm postgres:16 psql 'postgres://tsdbadmin:Buslogic123%21@b96osgyp1w.duvl2ceai2.tsdb.cloud.timescale.com:31143/tsdb?sslmode=require' -c "
SELECT
  pid,
  state,
  NOW() - query_start as duration,
  LEFT(query, 100) as query
FROM pg_stat_activity
WHERE state = 'active'
  AND query LIKE '%refresh_continuous_aggregate%';"
```

---

## ⚠️ Potencijalni Problemi i Rešenja

### Problem 1: PostGIS funkcija ne radi
**Simptom:**
```
ERROR: function st_distance(public.geography, public.geography) does not exist
```

**Uzrok:** Funkcija nema eksplicitne castove
**Rešenje:** Već implementirano u migraciji:
```sql
public.ST_Distance(
  locations[i]::public.geography,
  locations[i-1]::public.geography
)
```

### Problem 2: Timeout pri refresh-u
**Simptom:**
```
ERROR: canceling statement due to statement timeout
```

**Uzrok:** Previše podataka, refresh traje dugo
**Rešenje:** Refresh po mesecima:
```sql
-- Samo septembar
CALL refresh_continuous_aggregate(
  'monthly_vehicle_distance',
  '2025-09-01'::timestamptz,
  '2025-10-01'::timestamptz
);

-- Samo avgust
CALL refresh_continuous_aggregate(
  'monthly_vehicle_distance',
  '2025-08-01'::timestamptz,
  '2025-09-01'::timestamptz
);
```

### Problem 3: Aggregate prazan nakon refresh-a
**Simptom:**
```sql
SELECT COUNT(*) FROM monthly_vehicle_distance;
-- vraća 0
```

**Debug:**
```sql
-- 1. Proveri da li partial view vraća podatke
SELECT COUNT(*) FROM _timescaledb_internal._partial_view_XX;

-- 2. Proveri logs
SELECT * FROM timescaledb_information.jobs
WHERE application_name LIKE '%monthly%';

-- 3. Proveri errors
SELECT * FROM timescaledb_information.job_stats
WHERE job_id IN (
  SELECT job_id FROM timescaledb_information.jobs
  WHERE application_name LIKE '%monthly%'
);
```

### Problem 4: Frontend prikazuje stare podatke
**Uzrok:** Frontend cache ili API response cache
**Rešenje:**
```bash
# Restartuj backend
docker restart backend-container-name

# Clear Redis cache (ako se koristi)
docker exec redis-container redis-cli FLUSHALL
```

---

## ✅ Validacija Rezultata

### 1. Proveri da li aggregati rade

```sql
-- Monthly aggregate
SELECT
  month_utc,
  year_belgrade,
  month_belgrade,
  vehicle_id,
  garage_no,
  total_km
FROM monthly_vehicle_distance
WHERE vehicle_id IN (1, 2, 460)  -- Poznata vozila
ORDER BY month_utc DESC, vehicle_id
LIMIT 10;
```

**Očekivano:**
- ✅ Vrsta podaci za septembar 2025
- ✅ `total_km` između 200-300 km po mesecu za gradski prevoz
- ✅ `year_belgrade = 2025`, `month_belgrade = 9`

```sql
-- Hourly aggregate
SELECT
  date_belgrade,
  year_belgrade,
  month_belgrade,
  vehicle_id,
  SUM(total_km) as daily_km
FROM hourly_vehicle_distance
WHERE vehicle_id = 460
  AND year_belgrade = 2025
  AND month_belgrade = 9
GROUP BY date_belgrade, year_belgrade, month_belgrade, vehicle_id
ORDER BY date_belgrade DESC
LIMIT 10;
```

**Očekivano:**
- ✅ Dnevna kilometraža 200-300 km
- ✅ Sumirane vrednosti odgovaraju monthly aggregate-u

### 2. Uporedi sa starim podacima (Pre migracije)

**Ako imaš backup:**
```sql
-- Stari pristup (bez filtera)
SELECT
  SUM(
    ST_Length(ST_MakeLine(location ORDER BY time)::geography) / 1000.0
  ) as km_stari_pristup
FROM gps_data
WHERE vehicle_id = 460
  AND DATE(time AT TIME ZONE 'Europe/Belgrade') = '2025-09-17'
  AND speed > 0;
```

**Očekivano:** ~2,600 km (sa glitchevima)

```sql
-- Novi pristup (sa HIBRIDNIM filterom)
SELECT total_km
FROM monthly_vehicle_distance
WHERE vehicle_id = 460
  AND year_belgrade = 2025
  AND month_belgrade = 9;
```

**Očekivano:** ~6,500 km (ceo mesec, bez glitcheva)

### 3. Proveri Belgrade timezone tačnost

```sql
-- Uporedi UTC bucket vs Belgrade filter
SELECT
  'Monthly UTC bucket' as pristup,
  total_km
FROM monthly_vehicle_distance
WHERE vehicle_id = 460
  AND month_utc = '2025-09-01'

UNION ALL

SELECT
  'Hourly Belgrade filter' as pristup,
  SUM(total_km)
FROM hourly_vehicle_distance
WHERE vehicle_id = 460
  AND year_belgrade = 2025
  AND month_belgrade = 9;
```

**Očekivano:**
- Monthly UTC: ~6,508 km (uključuje 2h iz oktobra)
- Hourly Belgrade: ~6,462 km (tačan septembar)
- **Razlika:** ~50 km (OK)

---

## 📱 Frontend Integration Notes

### Kako koristiti agreggate za Belgrade mesečne izveštaje

**PREPORUČENO - Hourly aggregate:**
```typescript
// API call - Backend
const monthlyStats = await db.query(`
  SELECT
    year_belgrade,
    month_belgrade,
    vehicle_id,
    SUM(total_km) as total_km,
    SUM(total_points) as total_points,
    AVG(avg_speed) as avg_speed
  FROM hourly_vehicle_distance
  WHERE vehicle_id = $1
    AND year_belgrade = $2
    AND month_belgrade = $3
  GROUP BY year_belgrade, month_belgrade, vehicle_id
`, [vehicleId, 2025, 9]);
```

**Alternativa - Monthly aggregate:**
```typescript
// Brži, ali sa UTC bucketom (+2h iz sledećeg meseca)
const monthlyStats = await db.query(`
  SELECT
    year_belgrade,
    month_belgrade,
    vehicle_id,
    total_km,
    total_points,
    avg_speed
  FROM monthly_vehicle_distance
  WHERE vehicle_id = $1
    AND year_belgrade = $2
    AND month_belgrade = $3
`, [vehicleId, 2025, 9]);
```

---

## 🔄 Rollback Plan (Ako nešto pođe po zlu)

### Rollback migracija

```bash
cd /home/kocev/smart-city/apps/backend/timescale

# Rollback hourly
export PATH=$PATH:~/bin
dbmate --migrations-dir ./migrations rollback

# Rollback monthly (ako treba)
dbmate --migrations-dir ./migrations rollback
```

**Šta rollback radi:**
1. Drop-uje nove aggregate-e
2. Drop-uje HIBRIDNU funkciju
3. Kreira stare aggregate-e (BEZ outlier filtera)
4. Dodaje refresh policies
5. Kreira indekse

**VAŽNO:** Posle rollback-a mora da se refresh-uju stari aggregati!

```sql
CALL refresh_continuous_aggregate('monthly_vehicle_distance', NULL, NULL);
CALL refresh_continuous_aggregate('hourly_vehicle_distance', NULL, NULL);
```

---

## 📚 Reference Documents

### Migracije:
1. `20251003053137_recreate_monthly_distance_with_outlier_filter.sql`
2. `20251003124547_recreate_hourly_distance_with_hybrid_filter.sql`

### Code Files:
- Backend Service: `apps/backend/src/gps-analytics/gps-analytics.service.ts` (NIJE MENJANO)
- Frontend: `apps/admin-portal/src/pages/transport/dispatcher/analytics` (možda treba update)

### Industry Standards:
- **Geotab, Samsara** fleet management sistemi koriste Distance + Speed threshold filter
- **PostGIS** ne nudi built-in outlier filtering - custom implementacija
- **GPS accuracy:** 2-5m (1.5% error) - bolji od odometra (5-15% error)

---

## 🎓 Naučene Lekcije

### Tehnički Insights:

1. **TimescaleDB Continuous Aggregates NE PODRŽAVAJU:**
   - Window funkcije (LAG, LEAD) direktno u GROUP BY
   - Views ili CTE-ove kao data source
   - Rešenje: Custom PostgreSQL funkcija sa array_agg()

2. **PostGIS u Continuous Aggregate kontekstu:**
   - Mora eksplicitno: `public.ST_Distance(loc1::public.geography, loc2::public.geography)`
   - Bez toga: `ERROR: function st_distance does not exist`

3. **UTC vs Belgrade Time Bucketing:**
   - UTC `time_bucket()` je OBAVEZAN za continuous aggregates
   - Belgrade metadata kolone omogućavaju tačne mesečne izveštaje
   - Hourly aggregate + Belgrade filter = NAJBOLJI pristup

4. **Outlier Filter Choice:**
   - Analytics pristup (briše tačke) = 6,483 km
   - Custom pristup (preskače segmente) = 6,121 km
   - **HIBRIDNI** (distance + speed) = 6,462 km ✅
   - Industry standard: Distance + Speed threshold

---

## ✅ Final Checklist Pre Push-a

- [x] Lokalno testirano na razvoj bazi
- [x] Migracije prošle bez greške
- [x] Aggregati popunjeni podacima
- [x] Rezultati validni (6,462 km vs 73,474 km)
- [x] Belgrade timezone metadata radi
- [x] Rollback plan dokumentovan
- [ ] Commit na GitHub
- [ ] Push na main
- [ ] Deployment na live server
- [ ] Validacija na live podacima
- [ ] Frontend testing

---

## 📞 Kontakt Info

**Developer:** Claude Code
**Datum implementacije:** 2025-10-03
**Session ID:** smart-city-gps-outlier-filtering

**Za pitanja:**
- Proveri logs: `/home/kocev/smart-city/apps/backend/timescale/`
- Session summary: Ovaj fajl
- Git history: `git log --oneline migrations/`

---

**END OF SESSION SUMMARY**
