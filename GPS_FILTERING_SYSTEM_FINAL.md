# GPS Vehicle Filtering System - Finalna Dokumentacija

## 📅 Implementirano: 03.09.2025
## ✅ Status: PRODUKCIJSKI SPREMAN
## 🔄 Poslednje ažuriranje: 03.09.2025 16:30

---

## 🔐 RBAC Permisije (NOVO - 03.09.2025)

### Dispatcher modul permisije:
- `dispatcher.manage_cron` - Upravljanje cron procesima
- `dispatcher.view_dashboard` - Pregled dispečerskog dashboard-a  
- `dispatcher.manage_gps` - Upravljanje GPS sistemom (uključuje reset statistika)
- `dispatcher.view_sync_dashboard` - Pregled GPS sync dashboard-a

### Dodavanje permisija:
```bash
# Kreiraj Prisma migraciju
npx prisma migrate dev --name add-dispatcher-permissions

# Ažuriraj UI tree
# Fajl: /apps/admin-portal/src/pages/users/components/PermissionsTree.tsx
```

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

## 🎛️ Dashboard Kontrole (NOVO - 03.09.2025)

### GPS Sync Dashboard (`/transport/dispatcher/gps-sync-dashboard`)

#### Funkcionalnosti:
1. **Screen Process kontrole** (Legacy Server):
   - Start/Stop/Restart screen sesija za teltonika60-76
   - Real-time status prikaz (Aktivan/Neaktivan)
   - Automatska provera screen sesija preko SSH

2. **Cron Process kontrole** (Legacy Server):
   - Pause/Run kontrole za Smart City cron procesore
   - Dostupno samo za teltonika60 i teltonika61
   - Ručno pokretanje procesiranja

3. **GPS Uređaji monitoring**:
   - Real-time broj aktivnih GPS uređaja po portu
   - Prikaz bez ograničenja (overflowCount: 999999)
   - Refresh svakih 30 sekundi

4. **Reset Statistika**:
   - Brisanje svih podataka iz `gps_processing_stats`
   - Resetovanje buffer statusa
   - Popconfirm dijalog za sigurnost

#### Backend Endpoints:
```bash
# Kontrola screen sesija
POST /api/gps-sync-dashboard/cron-control
{
  "action": "start" | "stop",
  "cronName": "Teltonika60 GPS Processor",
  "instance": 60
}

# Kontrola cron procesa
POST /api/gps-sync-dashboard/cron-process-control
{
  "action": "start" | "stop" | "run",
  "instance": 60 | 61
}

# Reset statistika
POST /api/gps-sync-dashboard/reset-statistics
```

#### SSH Komande (automatski izvršavaju se iz dashboard-a):
```bash
# Start screen sesije
screen -dmS teltonika60 /var/www/teltonika60/start_teltonika.sh

# Stop screen sesije
screen -S teltonika60 -X quit

# Proveri aktivne screen sesije
screen -ls | grep teltonika

# Broj aktivnih GPS konekcija
ss -tan | grep :12060 | grep ESTAB | wc -l
```

### Teltonika61 Setup (NOVO):
```bash
/var/www/teltonika61/
├── smart-city-config.php         # Konfiguracija
├── smart-city-raw-processor.php  # Processor
├── smart-city-gps-vehicles.json  # Filter (978 vozila)
└── smart-city-gps-raw-log.txt    # Raw log

# Cron job za teltonika61
*/2 * * * * /usr/bin/php /var/www/teltonika61/smart-city-raw-processor.php
```

## 🛡️ Sigurnosni Processor sa Retry Mehanizmom (NOVO - 03.09.2025 19:30)

### Problem koji je rešen:
Stari processor je **BRISAO podatke čak i kada server nije bio dostupan**, što je dovodilo do gubitka GPS podataka. Novi processor implementira:

1. **Retry mehanizam** - 3 pokušaja sa eksponencijalnim backoff (2s, 4s, 8s)
2. **Failed logs folder** - čuva neuspešne batch-eve za kasniji recovery
3. **NE BRIŠE raw log** ako slanje nije uspelo
4. **Recovery skripta** - omogućava ponovno slanje failed logova

### Implementirani fajlovi:
```
/var/www/teltonika60-64/
├── smart-city-raw-processor.php      # NOVI safe processor sa retry
├── smart-city-raw-processor.php.old-unsafe  # Backup starog processor-a
├── smart-city-recovery.php           # Recovery skripta za failed logs
├── failed_logs/                      # Direktorijum za neuspešne batch-eve
│   └── failed_YYYYMMDD_HHMMSS_*.json
└── smart-city-tests/                 # Test scenariji
    ├── test-scenario-1-server-available.sh
    ├── test-scenario-2-server-unavailable.sh
    ├── test-scenario-3-intermittent.sh
    ├── test-scenario-4-recovery.sh
    └── run-all-tests.sh
```

### Testiranje (teltonika60):
```bash
# Scenario 1: Server dostupan ✅
# Rezultat: Podaci uspešno poslati, raw log obrisan

# Scenario 2: Server nedostupan ✅
# Rezultat: 3 pokušaja sa retry, raw log SAČUVAN, failed logs kreirani

# Scenario 3: Retry mehanizam ✅
# Rezultat: Eksponencijalni backoff radi (2s, 4s, 8s između pokušaja)

# Scenario 4: Failed logs recovery ✅
# Rezultat: Recovery skripta uspešno šalje failed logs kada server postane dostupan
```

### Recovery proces:
```bash
# Ručno pokreni recovery za failed logs
ssh root@79.101.48.11 'php /var/www/teltonika60/smart-city-recovery.php'

# Automatski recovery (dodati u cron)
*/10 * * * * /usr/bin/php /var/www/teltonika60/smart-city-recovery.php
```

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

## 📋 Implementacijski Status

### ✅ Potpuno implementirano:
- Vehicle filter sa 978 vozila
- Dual-send arhitektura (Production + Test)
- Centralizovana konfiguracija (smart-city-config.php)
- Batch procesiranje (200 tačaka)
- Processor filtrira vozila koja nisu u bazi
- Timestamp konverzija ispravna (GPS vreme, ne server vreme)
- Boolean konverzija za in_route
- Deduplicacija duplikata u TimescaleDB po vehicle_id + timestamp
- Cron job svakih 2 minuta
- Monitoring skripta
- Backup sistem za procesirane logove (YYYY/MM/DD struktura)
- Error logging
- API key autentifikacija
- Cleanup cron jobs (2 min za processed, 10 dana za stats)
- Dashboard kontrole za screen sesije (Start/Stop/Restart)
- Dashboard kontrole za cron procese (Pause/Run)
- Real-time broj GPS uređaja po portu
- Reset statistika funkcionalnost
- RBAC permisije za dispatcher modul
- Teltonika60-64 setup sa Smart City integracijom
- **Safe processor sa retry mehanizmom (NOVO)**
- **Failed logs recovery sistem (NOVO)**
- **Test scenariji za sve slučajeve (NOVO)**

### 🔄 U planu:
- Automatska sinhronizacija filtera (6h)
- Alerting sistem za greške
- Log rotacija za processor log
- Grafana dashboard
- Automatski recovery cron job

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

# Recovery failed logs
ssh root@79.101.48.11 'php /var/www/teltonika60/smart-city-recovery.php'

# Pokreni svi test scenariji
ssh root@79.101.48.11 'cd /var/www/teltonika60/smart-city-tests && ./run-all-tests.sh'

# Promeni na PROD-only mode
ssh root@79.101.48.11 "sed -i \"s/define('TEST_ENABLED', true)/define('TEST_ENABLED', false)/\" /var/www/teltonika60/smart-city-config.php"

# Promeni na DEV+PROD mode
ssh root@79.101.48.11 "sed -i \"s/define('TEST_ENABLED', false)/define('TEST_ENABLED', true)/\" /var/www/teltonika60/smart-city-config.php"

# Proveri failed logs
ssh root@79.101.48.11 'ls -la /var/www/teltonika60/failed_logs/'
```

---

*Dokumentacija kreirana: 03.09.2025*  
*Poslednje ažuriranje: 03.09.2025 19:35 - Dodato: Safe Processor sa Retry*  
*Autor: Smart City Development Tim*