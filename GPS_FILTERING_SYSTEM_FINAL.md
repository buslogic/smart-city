# GPS Vehicle Filtering System - Finalna Dokumentacija

## 📅 Implementirano: 03.09.2025
## ✅ Status: PRODUKCIJSKI SPREMAN
## 🔄 Poslednje ažuriranje: 03.09.2025 13:10

---

## 🎯 Pregled Sistema

Sistem filtrira GPS podatke sa legacy servera i procesira **samo vozila koja postoje u našoj bazi** (978 od ~2000 vozila). Podržava paralelno slanje na produkcijski i test/development server.

### Tok Podataka:
```
Teltonika → Legacy Server → Raw Log → Filter → Batch Processor → API → MySQL Buffer → TimescaleDB
    ↓            ↓             ↓         ↓           ↓             ↓         ↓              ↓
112 uređaja   pisanje      2-5K tačaka  978      200 batch   Dual send  30 sek      Finalno
              u log         /2 min     vozila    /request    Prod+Test  cleanup     skladište
```

### Ključne Statistike (Real-time):
- **45% podataka se prihvata** (978 od ~2000 vozila)
- **112 GPS uređaja** trenutno povezano
- **2000-5000 GPS tačaka** po 2-minutnom ciklusu
- **135 jedinstvenih vozila** aktivno u poslednjih 2 minuta
- **Maksimalno kašnjenje**: 2 min 30 sek (poboljšano sa 5 min)

---

## 📁 Implementirane Komponente

### 1. Legacy Server (79.101.48.11)

#### Fajlovi:
```
/var/www/teltonika60/
├── smart-city-config.php                 # Centralizovana konfiguracija (NOVO)
├── smart-city-raw-processor.php          # Processor sa filterom i dual-send
├── smart-city-gsp-vehicles-sync-filter.php # Sync lista vozila
├── smart-city-gps-vehicles.json          # Filter sa 978 vozila
├── smart-city-monitor-gps.sh             # Monitoring skripta
├── smart-city-gps-raw-log.txt            # Trenutni raw log
├── smart-city-errors.log                 # Error log fajl
├── processed_logs/                       # Arhiva procesiranih logova
└── smart-city-backup/                    # Backup originalnih fajlova
```

#### Cron Jobs:
```bash
# Procesiranje raw log-a svakih 2 minuta
*/2 * * * * /usr/bin/php /var/www/teltonika60/smart-city-raw-processor.php >> /var/log/smart-city-raw-processor.log 2>&1
```

### 2. Backend (Smart City)

#### API Endpoints:
- `GET /api/vehicles-gps/export` - Export aktivnih vozila za GPS filter
  - API key: `gps-sync-key-2025`
  - Vraća JSON sa `id` i `garageNumber` za svako vozilo
- `POST /api/gps-legacy/ingest` - Prijem GPS podataka sa legacy servera
  - API key: `gps-legacy-key-2025-secure`
  - Batch prijem do 200 tačaka

#### GPS Processor Service:
- Cron: **svakih 30 sekundi**
- Batch procesiranje do 4000 tačaka
- Deduplicacija po `vehicle_id + timestamp`
- Boolean konverzija za `in_route`
- Cleanup processed zapisa nakon 5 minuta
- Stats cleanup nakon 10 dana

### 3. Baze Podataka

#### MySQL Buffer (`gps_raw_buffer`):
- Privremeno skladište GPS podataka
- Automatsko brisanje nakon uspešnog transfera

#### TimescaleDB:
- Finalno skladište sa PostGIS ekstenzijama
- Hypertable sa automatskom particijom po danima
- Unique constraint na `(vehicle_id, time)`

---

## 🔧 Konfiguracija i Deployment

### 🖥️ Local Development Setup

#### 1. Konfiguracija na Legacy serveru:
```php
// /var/www/teltonika60/smart-city-config.php

// Test/Development Server (za lokalni development)
define('TEST_ENABLED', true); // Uključi slanje na test server
define('TEST_API_URL', 'http://localhost:3010/api/gps-legacy/ingest'); 
define('TEST_API_KEY', 'gps-legacy-key-2025-secure');
```

#### 2. SSH tunel za lokalni pristup:
```bash
# Sa lokalne mašine, otvori tunel ka legacy serveru
ssh -i ~/.ssh/hp-notebook-2025-buslogic -R 3010:localhost:3010 root@79.101.48.11
```

#### 3. Testiranje sa manjim batch-om:
```bash
# Promeni batch size za testiranje
ssh root@79.101.48.11
vim /var/www/teltonika60/smart-city-config.php
# Postavi: define('BATCH_SIZE', 10);
```

### 🚀 Production Setup

#### Konfiguracija:
```php
// Production Server (UVEK AKTIVAN)
define('PROD_API_URL', 'http://157.230.119.11/api/gps-legacy/ingest');
define('PROD_API_KEY', 'gps-legacy-key-2025-secure');
define('PROD_ENABLED', true); // Ne menjati - produkcija je uvek aktivna

// Test server - isključiti za produkciju
define('TEST_ENABLED', false); // Isključi test slanje
```

### Vehicle Filter Sync:
```bash
# Ručno sinhronizovanje liste vozila
ssh root@79.101.48.11
php /var/www/teltonika60/smart-city-gsp-vehicles-sync-filter.php

# Automatska sinhronizacija (dodati u cron)
0 */6 * * * /usr/bin/php /var/www/teltonika60/smart-city-gsp-vehicles-sync-filter.php
```

### Monitoring:
```bash
# Proveri status sistema
ssh root@79.101.48.11
/var/www/teltonika60/smart-city-monitor-gps.sh
```

Output pokazuje:
- Broj linija u trenutnom log-u
- Broj jedinstvenih vozila 
- Broj vozila u filteru
- Statistike procesiranja
- Broj aktivnih GPS konekcija

---

## 📊 Performanse i Statistike

### Real-time Statistike (03.09.2025 13:00):
- **Aktivnih GPS uređaja**: 112
- **Jedinstvenih vozila**: 135 u poslednjih 2 minuta
- **GPS tačke po ciklusu**: 2000-5000 (svakih 2 minuta)
- **Filtriranje**: 45% prihvaćeno, 55% odbačeno
- **Batch procesiranje**: 200 tačaka po request-u
- **Prosečno procesiranih**: ~2200 tačaka po ciklusu

### Opterećenje Sistema:
- **Legacy server**: Minimalno (pisanje u log + PHP procesiranje)
- **Cron interval**: 2 minuta (poboljšano sa 5)
- **Backend API**: 11-12 request-a svakih 2 minuta
- **MySQL Buffer**: ~1100 INSERT-a po minuti
- **TimescaleDB**: Batch INSERT svakih 30 sekundi (4000 zapisa)
- **Cleanup**: Svakih 2 minuta za processed, 5 minuta za failed

---

## 🚨 Troubleshooting

### Problem: Podaci ne stižu u TimescaleDB
```bash
# Proveri MySQL buffer
docker exec smartcity-mysql-local mysql -u smartcity_user -pSecurePassword123! smartcity_dev \
  -e "SELECT process_status, COUNT(*) FROM gps_raw_buffer GROUP BY process_status;"

# Proveri backend log
docker logs backend-app | grep GpsProcessor

# Proveri da li processor radi
curl http://localhost:3010/api/gps-sync-dashboard/buffer-status
```

### Problem: Filter ne radi
```bash
# Proveri da li filter postoji
ssh root@79.101.48.11 'wc -l /var/www/teltonika60/smart-city-gps-vehicles.json'

# Re-sync filter
ssh root@79.101.48.11 'php /var/www/teltonika60/smart-city-gsp-vehicles-sync-filter.php'

# Proveri sadržaj filtera
ssh root@79.101.48.11 'head -20 /var/www/teltonika60/smart-city-gps-vehicles.json'
```

### Problem: Raw log raste preveliki
```bash
# Proveri veličinu log-a
ssh root@79.101.48.11 'ls -lh /var/www/teltonika60/smart-city-gps-raw-log.txt'

# Ručno procesiranje
ssh root@79.101.48.11 'php /var/www/teltonika60/smart-city-raw-processor.php'

# Proveri cron
ssh root@79.101.48.11 'crontab -l | grep smart-city-raw-processor'

# Proveri poslednje procesiranje
ssh root@79.101.48.11 'tail -20 /var/log/smart-city-raw-processor.log'
```

### Problem: Test server ne prima podatke
```bash
# Proveri konfiguraciju
ssh root@79.101.48.11 'grep TEST_ENABLED /var/www/teltonika60/smart-city-config.php'

# Proveri SSH tunel
ssh root@79.101.48.11 'curl -X POST http://localhost:3010/api/gps-legacy/ingest -H "x-api-key: gps-legacy-key-2025-secure" -H "Content-Type: application/json" -d "{\"points\":[]}"'

# Proveri error log
ssh root@79.101.48.11 'tail -20 /var/www/teltonika60/smart-city-errors.log'
```

---

## ✅ Checklist za Produkciju

### Implementirano:
- [x] Vehicle filter sa 978 vozila
- [x] Dual-send arhitektura (Production + Test)
- [x] Centralizovana konfiguracija (smart-city-config.php)
- [x] Batch procesiranje (200 tačaka)
- [x] Processor filtrira vozila koja nisu u bazi
- [x] Timestamp konverzija ispravna
- [x] Boolean konverzija za in_route
- [x] Deduplicacija duplikata u TimescaleDB
- [x] Cron job svakih 2 minuta
- [x] Monitoring skripta
- [x] Backup sistem za procesirane logove
- [x] Error logging
- [x] API key autentifikacija
- [x] Cleanup cron jobs (2 min, 10 dana)

### U planu:
- [ ] Automatska sinhronizacija filtera (6h)
- [ ] Alerting sistem za greške
- [ ] Log rotacija za processor log
- [ ] Grafana dashboard

---

## 📈 Arhitektura i Skalabilnost

### Trenutna arhitektura podržava:
- **2000+ vozila** sa legacy servera
- **978 vozila** u našoj bazi (filtriranih)
- **112 simultanih GPS konekcija**
- **66,000 GPS tačaka po satu** (prosek)
- **Dual-send** za Production i Test environment

### Optimizacije u toku:
- Smanjenje cron intervala sa 2 na 1 minut
- Povećanje batch size-a na 500 (sa 200)
- Real-time WebSocket broadcasting
- Direktna integracija sa Teltonika uređajima (bypass legacy)

---

## 📞 Kontakti i Pristup

### SSH Pristup:
```bash
# Legacy GPS Server
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11

# Production Backend Server  
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@157.230.119.11
```

### API Endpoints:
```bash
# Production
https://gsp-admin.smart-city.rs/api/gps-legacy/ingest
https://gsp-admin.smart-city.rs/api/vehicles-gps/export

# Local Development
http://localhost:3010/api/gps-legacy/ingest
http://localhost:3010/api/vehicles-gps/export
```

### Database Connections:
```bash
# MySQL (Development)
mysql://smartcity_user:SecurePassword123!@localhost:3325/smartcity_dev

# TimescaleDB (GPS Storage)
postgres://smartcity_ts:smartcity_ts@localhost:5433/smartcity_gps
```

### API Keys:
- **GPS Legacy Ingest**: `gps-legacy-key-2025-secure`
- **Vehicle Export**: `gps-sync-key-2025`

---

## 📝 Monitoring Komande - Quick Reference

### Status provere:
```bash
# Kompletni monitoring
ssh root@79.101.48.11 '/var/www/teltonika60/smart-city-monitor-gps.sh'

# Proveri raw log
ssh root@79.101.48.11 'wc -l /var/www/teltonika60/smart-city-gps-raw-log.txt'

# Poslednje procesiranje
ssh root@79.101.48.11 'tail -5 /var/log/smart-city-raw-processor.log'

# Aktivne GPS konekcije
ssh root@79.101.48.11 'ss -tan | grep :12060 | grep ESTAB | wc -l'

# MySQL buffer status (lokalno)
docker exec smartcity-mysql-local mysql -u smartcity_user -pSecurePassword123! smartcity_dev \
  -e "SELECT process_status, COUNT(*) as count FROM gps_raw_buffer GROUP BY process_status;"

# TimescaleDB status (lokalno)
docker exec smartcity-timescale psql -U smartcity_ts -d smartcity_gps \
  -c "SELECT COUNT(*) FROM gps_data WHERE time > NOW() - INTERVAL '1 hour';"
```

### Upravljanje:
```bash
# Ručno pokreni procesiranje
ssh root@79.101.48.11 'php /var/www/teltonika60/smart-city-raw-processor.php'

# Sinhronizuj vehicle filter
ssh root@79.101.48.11 'php /var/www/teltonika60/smart-city-gsp-vehicles-sync-filter.php'

# Promeni na PROD-only mode
ssh root@79.101.48.11 "sed -i \"s/define('TEST_ENABLED', true)/define('TEST_ENABLED', false)/\" /var/www/teltonika60/smart-city-config.php"

# Promeni na DEV+PROD mode
ssh root@79.101.48.11 "sed -i \"s/define('TEST_ENABLED', false)/define('TEST_ENABLED', true)/\" /var/www/teltonika60/smart-city-config.php"
```

---

*Dokumentacija kreirana: 03.09.2025*  
*Poslednje ažuriranje: 03.09.2025 13:15*  
*Autor: Smart City Development Tim*