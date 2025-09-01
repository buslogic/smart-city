# 📚 DBMATE - Kompletan vodič za TimescaleDB migracije

## 🔍 Šta je dbmate?

Dbmate je alat za database migracije koji omogućava verzionisanje i sinhronizaciju database sheme između developera i produkcijskih servera. Koristi plain SQL fajlove za migracije.

## ⚙️ Konfiguracija

### Environment varijable
```bash
# U .env fajlu ili export
DATABASE_URL="postgresql://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps?sslmode=disable"

# Alternativno možeš koristiti config fajl
# dbmate.yml
```

### 📍 NAŠA LOKACIJA ZA MIGRACIJE
```bash
# UVEK prelazi u ovaj direktorijum pre rada sa migracijama:
cd /home/kocev/smart-city/apps/backend/timescale

# Migracije se nalaze u:
/home/kocev/smart-city/apps/backend/timescale/migrations/
```

### Struktura direktorijuma
```
/home/kocev/smart-city/apps/backend/timescale/
├── .env                    # DATABASE_URL
├── dbmate.yml             # Konfiguracija (opciono)
├── migrations/            # Folder sa SQL migracijama
│   ├── 20250901_001_initial_seed.sql
│   └── 20250901_002_aggressive_driving.sql
├── verify-migrations.py   # Naša skripta za verifikaciju
└── DBMATE_GUIDE.md       # Ovaj dokument
```

## 📝 Osnovne komande

### 1. Status - proveri koje migracije su primenjene
```bash
dbmate --migrations-dir ./migrations status

# Output:
# [X] 20250901_001_initial_seed.sql        # Primenjena
# [ ] 20250901_002_aggressive_driving.sql  # Čeka
```

### 2. Create - napravi novu migraciju
```bash
dbmate --migrations-dir ./migrations new naziv_migracije

# Kreira: migrations/YYYYMMDDhhmmss_naziv_migracije.sql
# Primer: migrations/20250901114523_naziv_migracije.sql

# ⚠️ VAŽNO: Timestamp MORA biti jedinstven!
# Nemoj koristiti format kao: 20250901_001_naziv.sql
# Koristi pun timestamp: 20250901114523_naziv.sql
```

### 3. Up - primeni sve migracije
```bash
dbmate --migrations-dir ./migrations up

# Primenjuje sve migracije koje nisu označene kao primenjene
```

### 4. Rollback/Down - vrati poslednju migraciju
```bash
dbmate --migrations-dir ./migrations rollback

# Izvršava migrate:down sekciju poslednje migracije
```

### 5. Dump - eksportuj trenutnu shemu
```bash
dbmate --migrations-dir ./migrations dump

# Kreira: db/schema.sql sa celom strukturom baze
```

## 📄 Format migracije

```sql
-- migrate:up
-- Ovde ide SQL koji se izvršava kada se migracija primenjuje
CREATE TABLE example (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100)
);

-- migrate:down
-- Ovde ide SQL za rollback (vraćanje) migracije
DROP TABLE IF EXISTS example;
```

## ⚠️ KRITIČNI PROBLEMI SA DBMATE

### 🔴 Problem #1: VERSION BROJ = SAMO VODEĆI BROJEVI!

**NAJVAŽNIJE OTKRIĆE:**
Dbmate koristi **SAMO VODEĆE BROJEVE** iz imena fajla kao version broj!

**Primer problema:**
```
20250901_001_initial_seed.sql       → version = "20250901" ❌
20250901_002_aggressive_driving.sql → version = "20250901" ❌
```
OBE migracije imaju ISTI version broj! Dbmate vidi samo jednu!

**ISPRAVNO:**
```
20250901000000_initial_seed.sql       → version = "20250901000000" ✅
20250901000001_aggressive_driving.sql → version = "20250901000001" ✅
```

### 🔴 Problem #2: Označava migraciju kao primenjenu PRE izvršavanja

**Šta se dešava:**
1. Dbmate upisuje migraciju u `schema_migrations`
2. ZATIM pokušava da izvrši SQL
3. Ako SQL padne, migracija OSTAJE označena kao primenjena!

**Posledice:**
- `dbmate status` pokazuje da je migracija primenjena
- Ali objekti (tabele, kolone, funkcije) NE POSTOJE u bazi
- Sledeći `dbmate up` PRESKAČE tu migraciju

### 🔴 Problem #2: Transakcije i TimescaleDB

Neki SQL ne može da se izvršava u transakciji:
- `CREATE MATERIALIZED VIEW ... WITH DATA`
- `REFRESH CONTINUOUS AGGREGATE`
- Neke TimescaleDB operacije

**Rešenje:** Koristi `WITH NO DATA` pa ručno refresh

### 🔴 Problem #3: Schema_migrations format

Dbmate čuva različite formate u schema_migrations:
- Ponekad: `20250901`
- Ponekad: `20250901_001_initial_seed`
- Ponekad: `20250901_001_initial_seed.sql`

## ✅ NAŠA REŠENJA

### 1. Verifikacija nakon svake migracije

```bash
# Uvek pokreni ovo nakon dbmate up:
cd /home/kocev/smart-city/apps/backend/timescale
python3 verify-migrations.py
```

### 2. Dodaj verifikaciju u migraciju

```sql
-- migrate:up
ALTER TABLE example ADD COLUMN new_col INTEGER;

-- Verifikuj da je kolona dodata
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'example' AND column_name = 'new_col'
    ) THEN
        RAISE EXCEPTION 'Kolona new_col nije kreirana!';
    END IF;
    RAISE NOTICE '✅ Migracija uspešna';
END $$;
```

### 3. Ručno čišćenje neuspešnih migracija

```python
# Obriši iz schema_migrations ako migracija nije stvarno primenjena
DELETE FROM schema_migrations WHERE version = 'problematicna_migracija';
```

## 📋 Procedura za sigurne migracije

### 1. PRE migracije
```bash
# Proveri status
dbmate --migrations-dir ./migrations status

# Proveri da li objekti već postoje
psql -c "SELECT * FROM information_schema.tables WHERE table_name = 'nova_tabela'"
```

### 2. TOKOM migracije
```bash
# Pokreni migraciju
dbmate --migrations-dir ./migrations up

# AKO PADNE - ODMAH:
# 1. Obriši iz schema_migrations
# 2. Popravi SQL grešku
# 3. Ponovi
```

### 3. POSLE migracije
```bash
# Verifikuj da su objekti kreirani
python3 verify-migrations.py

# Ili ručno proveri
psql -c "\dt"  # liste tabela
psql -c "\df"  # liste funkcija
```

## 🛠️ Korisni trikovi

### 1. Dry-run (test bez izvršavanja)
```bash
# Nažalost dbmate NEMA dry-run opciju!
# Alternativa: ručno proveri SQL
cat migrations/20250901_002_aggressive_driving.sql
```

### 2. Force re-run migracije
```bash
# 1. Obriši iz schema_migrations
psql -c "DELETE FROM schema_migrations WHERE version LIKE '%aggressive_driving%'"

# 2. Ponovo pokreni
dbmate up
```

### 3. Parcijalne migracije
```bash
# Dbmate NE PODRŽAVA pokretanje pojedinačnih migracija!
# Sve ili ništa pristup
```

## 🔧 Alternativni alati

Zbog problema sa dbmate, razmotri:

1. **Flyway** - Java-based, pouzdaniji
2. **Liquibase** - XML/YAML/JSON format
3. **migrate** - Go alat, sličan dbmate
4. **sqitch** - Git-like pristup migracijama
5. **Ručne SQL skripte** - Potpuna kontrola

## 📊 Schema_migrations tabela

```sql
-- Šta čuva dbmate
CREATE TABLE schema_migrations (
    version VARCHAR(255) PRIMARY KEY
);

-- Primer sadržaja
SELECT * FROM schema_migrations;
-- 20250901_001_initial_seed
-- 20250901_002_aggressive_driving

-- Ručno dodavanje/brisanje
INSERT INTO schema_migrations (version) VALUES ('20250901_003_new_feature');
DELETE FROM schema_migrations WHERE version = '20250901_003_new_feature';
```

## ⚡ Naš radni proces

```bash
# 0. UVEK PRVO - Prelazak u pravi direktorijum
cd /home/kocev/smart-city/apps/backend/timescale

# 1. Kreiraj migraciju
export PATH=$PATH:~/bin
dbmate --migrations-dir ./migrations new feature_name

# 2. Edituj SQL fajl
vim migrations/[timestamp]_feature_name.sql

# 3. Primeni migraciju
export PATH=$PATH:~/bin
dbmate --migrations-dir ./migrations up

# 4. OBAVEZNO verifikuj
python3 verify-migrations.py

# 5. Ako ne radi - ručno popravi
PGPASSWORD=TimescalePass123! psql -h localhost -p 5433 -U smartcity_ts -d smartcity_gps -f migrations/[file].sql
```

## 🚨 ZLATNA PRAVILA

1. **KORISTI PUN TIMESTAMP FORMAT** - YYYYMMDDhhmmss_naziv.sql (20250901114523_naziv.sql)
2. **NIKAD ne koristi format sa _001_** - dbmate vidi samo brojeve do prve _ 
3. **NIKAD ne veruj dbmate status-u** - uvek proveri da li objekti stvarno postoje
4. **Dodaj verifikaciju u migracije** - RAISE EXCEPTION ako nešto nije kako treba
5. **Testiraj lokalno pre produkcije** - očisti bazu i ponovo primeni sve
6. **Čuvaj backup pre velikih migracija** - pg_dump pre opasnih operacija
7. **Koristi verify-migrations.py** - naša skripta koja stvarno proverava

## 📝 Kako dbmate čuva migracije u schema_migrations

```sql
-- Dbmate čuva SAMO VODEĆE BROJEVE do prvog ne-numeričkog karaktera
SELECT * FROM schema_migrations;

-- Primer:
-- 20250901000000  (iz 20250901000000_initial_seed.sql)
-- 20250901000001  (iz 20250901000001_aggressive_driving.sql)
```

---
*Poslednje ažuriranje: 01.09.2025*
*Autor: Smart City Tim*