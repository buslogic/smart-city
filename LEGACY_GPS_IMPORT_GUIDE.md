# Legacy GPS Data Import Guide

## Legacy Server Konekcija

### Server sa GPS podacima
```bash
# Konektuj se na legacy GPS server (Teltonika)
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11
# ili
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@bgnaplatagps.rs
```

### MySQL baze na .11 serveru
- **pib100065430gps** - sadrži GPS tabele (P93597gps, P93598gps, P93599gps...)
- **pib100093425gps** - druga grupa GPS tabela

## Export GPS podataka sa Legacy servera

### 1. Proveri koliko podataka ima
```bash
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 "
mysql -uroot pib100065430gps -e \"
  SELECT COUNT(*) as total_records,
    MIN(captured) as oldest,
    MAX(captured) as newest
  FROM P93599gps;
\"
"
```

### 2. Napravi dump tabele
```bash
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 "
cd /tmp
mysqldump -uroot pib100065430gps P93599gps | gzip > P93599gps_export.sql.gz
ls -lh P93599gps_export.sql.gz
"
```

### 3. Prebaci dump na lokalni server
```bash
scp -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11:/tmp/P93599gps_export.sql.gz /home/kocev/smart-city/scripts/
```

## Import na lokalni server

### VAŽNO: Koristi JEDINU ISPRAVNU skriptu!
```bash
# KORISTI: fast-import-gps-to-timescale-docker.sh (jedinstvena ispravna verzija)
# Stara neispravna skripta je obrisana jer je imala problematičnu logiku

/home/kocev/smart-city/scripts/fast-import-gps-to-timescale-docker.sh /home/kocev/smart-city/scripts/P93599gps_export.sql.gz P93599
```

### Detaljan proces importa - šta se dešava u pozadini:

#### 1. Import GPS podataka (Step 1-3)
- **Provera vozila** - proverava da li vozilo postoji u MySQL bazi (bus_vehicles)
- **Priprema podataka** - ekstraktuje dump, konvertuje u CSV format
- **COPY u TimescaleDB** - koristi PostgreSQL COPY za brz import (50k+ zapisa/sekund)
  - Importuje u **gps_data** tabelu (hypertable)
  - Koristi ON CONFLICT (vehicle_id, time) DO UPDATE
  - Automatski kreira PostGIS location polje: ST_SetSRID(ST_MakePoint(lng, lat), 4326)

#### 2. Tabele koje se popunjavaju:

**gps_data (glavna hypertable):**
```sql
- time (TIMESTAMPTZ) - vreme GPS tačke (captured iz legacy)
- vehicle_id (INTEGER) - ID vozila iz naše baze
- garage_no (VARCHAR) - garažni broj (P93597, P93598...)
- lat, lng (DOUBLE PRECISION) - koordinate
- location (GEOMETRY) - PostGIS point
- speed, course, alt (DOUBLE PRECISION) - brzina, kurs, visina
- state (INTEGER) - stanje vozila
- in_route (BOOLEAN) - da li je na ruti
- data_source (TEXT) - 'historical_fast_import'
```

#### 3. Detekcija agresivne vožnje (Step 4)
- Poziva `detect_aggressive_driving_batch` SQL funkciju **DAN PO DAN**
- Funkcija analizira GPS tačke i detektuje:
  - harsh_braking (naglo kočenje)
  - harsh_acceleration (naglo ubrzanje)
- Popunjava **driving_events** tabelu:
```sql
- time (TIMESTAMPTZ) - vreme događaja
- vehicle_id, garage_no
- event_type (harsh_braking/harsh_acceleration)
- speed_before, speed_after - brzina pre/posle
- acceleration_value - ubrzanje/usporenje u m/s²
- g_force - G sila
- location, lat, lng - lokacija događaja
```
- UNIQUE constraint: (vehicle_id, time, event_type)

#### 4. Continuous Aggregates (Step 5)
Osvežavaju se TRI continuous aggregate view-a po mesecima:

**vehicle_hourly_stats:**
- Agregira podatke po satima
- Računa: broj tačaka, prosečnu brzinu, pređenu kilometražu

**daily_vehicle_stats:**
- Agregira podatke po danima
- Sadrži:
  - total_km - ukupna dnevna kilometraža
  - total_points - broj GPS tačaka
  - active_hours - aktivni sati
  - avg_speed, max_speed - brzine
  - first_point, last_point - prva/poslednja tačka

**monthly_vehicle_raw_stats:**
- Agregira događaje agresivne vožnje po mesecima
- Računa total_events za safety score

#### 5. Kako se računa kilometraža:
- PostGIS ST_Distance funkcija između uzastopnih GPS tačaka
- Samo između tačaka istog vozila sa <60 sekundi razlike
- Sabira se u daily_vehicle_stats.total_km

### Ključne izmene u skripti (04.09.2025):
- **Linija 194-231**: Detekcija agresivne vožnje se poziva DAN PO DAN umesto za celi period odjednom
- **Linija 245-265**: Continuous aggregates se osvežavaju pojedinačno (ne mogu biti u istoj transakciji)
- **Linija 245-265**: Dodato osvežavanje monthly_vehicle_raw_stats
- Razlog: Kada pozoveš detekciju za 4+ meseca odjednom, algoritam pogrešno tumači pauze između dana kao agresivnu vožnju

## Provera rezultata

### GPS podaci
```bash
PGPASSWORD=smartcity_ts_pass docker exec smartcity-timescale-local psql -U smartcity_ts -d smartcity_gps -c "
SELECT vehicle_id, garage_no, COUNT(*) as gps_points, MIN(time)::date as first_date, MAX(time)::date as last_date
FROM gps_data WHERE vehicle_id = 462 GROUP BY vehicle_id, garage_no;"
```

### Agresivna vožnja
```bash
PGPASSWORD=smartcity_ts_pass docker exec smartcity-timescale-local psql -U smartcity_ts -d smartcity_gps -c "
SELECT COUNT(*) as total_events, COUNT(DISTINCT DATE(time)) as days_with_events
FROM driving_events WHERE vehicle_id = 462 AND time >= '2025-07-01' AND time < '2025-08-01';"
```

## Vozila u lokalnoj bazi

| ID  | Garage Number | Legacy Table | Legacy DB         | Legacy Server |
|-----|--------------|--------------|-------------------|---------------|
| 460 | P93597       | P93597gps    | pib100065430gps   | 79.101.48.11  |
| 461 | P93598       | P93598gps    | pib100065430gps   | 79.101.48.11  |
| 462 | P93599       | P93599gps    | pib100065430gps   | 79.101.48.11  |

## Problem koji smo rešili

**Početni problem**: P93599 je imao 1748 agresivnih događaja za jul (178% - nemoguće!)

**Razlog**: Originalna skripta je pozivala `detect_aggressive_driving_batch` za CEL PERIOD (april-septembar) odjednom. Algoritam je tumačio svaku pauzu između dana kao naglo kočenje/ubrzanje.

**Rešenje**: Nova skripta poziva detekciju DAN PO DAN, kao što bi radio normalan CRON proces.

## Napomene

1. **GPS tačke se neće duplirati** - postoji UNIQUE constraint (vehicle_id, time)
2. **Driving events se neće duplirati** - postoji UNIQUE constraint (vehicle_id, time, event_type)  
3. **Bezbedno je pokrenuti skriptu više puta** - koristi ON CONFLICT DO UPDATE
4. **Funkcija detect_aggressive_driving_batch** već ima zaštitu - gleda samo tačke sa 1-10 sekundi razlike

## Brzina importa

- Buffer metoda (stara): ~1,200 zapisa/sekund
- Direct COPY metoda (nova): ~56,000 zapisa/sekund (47x brže!)
- Za 2000 vozila: 12.4 sata umesto 583 dana!