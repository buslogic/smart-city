# GPS Legacy System Integration - Smart City Platform v3.0

## 📅 Dokument kreiran: 31.08.2025
## 📅 Implementiran: 02.09.2025
## ✅ Status: TESTIRANO I SPREMNO ZA PRODUKCIJU
## 📍 Legacy server: 79.101.48.11 (teltonika60-76)
## 🎯 Smart City backend: localhost:3010 (development) / gsp-admin.smart-city.rs (production)

---

## 🎯 Pregled Implementacije

Uspešno implementiran sistem koji omogućava slanje GPS podataka sa legacy servera na Smart City platformu **BEZ PREKIDANJA** postojećeg rada.

### ✅ Šta je implementirano:

1. **Smart City Backend (ZAVRŠENO)**
   - MySQL buffer tabela `gps_raw_buffer`
   - GPS Ingest API endpoint `/api/gps-ingest/batch`
   - GpsProcessorService sa cron job-om (svakih 30 sekundi)
   - API key autentifikacija
   - Retry logika i error handling

2. **Legacy Server Integracija (SPREMNO)**
   - Modularni pristup sa 3 fajla
   - Vehicle filtering (WHITELIST/BLACKLIST/ALL)
   - Batch slanje sa konfigurisanjem
   - Sigurnosni prekidač (DISABLED mode)
   - Rollback skripte

### 🔄 Tok podataka:
```
Legacy PHP → Smart City API → MySQL Buffer → Cron Job → TimescaleDB
    ↓              ↓              ↓            ↓           ↓
Batch 50      API Key Auth   Brz INSERT   Svakih 30s   Finalno
```

---

## 📁 Implementirani fajlovi

### Na Legacy serveru (79.101.48.11):
```
/var/www/teltonika60/
├── smartcity_config.inc.php       # Konfiguracija (API, filtering)
├── smartcity_gps_helper.inc.php   # Helper funkcije
├── util_teltonika_ready.php       # Modifikovana verzija
├── switch_to_smartcity.sh         # Aktivacija skripta
├── switch_rollback.sh             # Rollback skripta
└── test_integration.php           # Test skripta
```

### Backup fajlovi:
```
├── util_teltonika.php.backup_20250902_124743_pre_smartcity
├── dbcred.inc.php.backup_20250902_124321
```

---

## 🔧 Konfiguracija

### `smartcity_config.inc.php` - Glavna konfiguracija

```php
// Environment selektor
define('SMARTCITY_ENV', 'DISABLED'); // DISABLED | LOCAL | STAGING | PRODUCTION

// Vehicle filtering
define('SMARTCITY_VEHICLE_FILTER_MODE', 'WHITELIST'); // ALL | WHITELIST | BLACKLIST
$SMARTCITY_VEHICLE_LIST = array(
    'P93597',  // Test vozilo 1
    'P93598',  // Test vozilo 2
);

// Batch podešavanja
define('SMARTCITY_BATCH_SIZE', 50);      // Broj GPS tačaka po batch-u
define('SMARTCITY_BATCH_TIMEOUT', 3);    // Timeout u sekundama
```

### Environment konfiguracije:

| Environment | API URL | API Key | Debug |
|------------|---------|---------|-------|
| DISABLED | - | - | - |
| LOCAL | http://localhost:3010/api/gps-ingest/batch | test-api-key-2024 | ON |
| STAGING | https://staging.smart-city.rs/api/gps-ingest/batch | staging-key | ON |
| PRODUCTION | https://gsp-admin.smart-city.rs/api/gps-ingest/batch | prod-key | OFF |

---

## 🚀 Aktivacija (5-10 sekundi prekid)

### ⚠️ VAŽNO: Pravilni redosled koraka
**MORA SE ZAMENITI KOD PRE RESTARTA!** PHP proces učitava util_teltonika.php pri pokretanju.

### 1. Provera pre aktivacije:
```bash
cd /var/www/teltonika60
php test_integration.php  # Test konfiguracije
```

### 2. Ručna aktivacija (ISPRAVAN REDOSLED):
```bash
cd /var/www/teltonika60

# KORAK 1: Najpre pripremi Smart City kod
cp util_teltonika_with_smartcity.php util_teltonika.php
chown apache:apache util_teltonika.php
chmod 755 util_teltonika.php

# KORAK 2: TEK ONDA restartuj servis
screen -XS teltonika60.bgnaplata quit
pkill -f 'teltonika60.*gps_teltonika'  # OBAVEZNO ubiti PHP proces
sleep 2

# KORAK 3: Pokreni sa NOVIM kodom
screen -m -d -S teltonika60.bgnaplata /var/www/teltonika60/start_teltonika.sh
```

### 3. Omogućavanje slanja podataka:
```bash
# Promeni DISABLED na LOCAL/PRODUCTION u smartcity_config.inc.php
sed -i "s/define('SMARTCITY_ENV', 'DISABLED');/define('SMARTCITY_ENV', 'LOCAL');/" smartcity_config.inc.php
```

### ⚠️ Napomene:
- GPS proces radi na portu **12060**, NE 30660!
- Uvek proveriti sa: `ss -tan | grep ':12060' | grep ESTAB | wc -l`
- Screen ID i PHP PID se menjaju pri svakom restartu

---

## 🔄 Rollback (ako zatreba)

```bash
./switch_rollback.sh
```

Ili ručno:
```bash
screen -XS teltonika60.bgnaplata quit
mv util_teltonika_main.php util_teltonika.php
screen -m -d -S teltonika60.bgnaplata /var/www/teltonika60/start_teltonika.sh
```

---

## 🧪 Testiranje

### 1. Test sa SSH tunelom (development):
```bash
# Terminal 1 - SSH tunel
ssh -R 3010:localhost:3010 root@79.101.48.11

# Terminal 2 - Test
ssh root@79.101.48.11
cd /var/www/teltonika60
php test_integration.php
```

### 2. Provera podataka:
```bash
# Na lokalnom računaru - proveri TimescaleDB
docker exec smartcity-timescale-local psql -U smartcity_ts -d smartcity_gps \
  -c "SELECT COUNT(*) FROM gps_data WHERE data_source = 'mysql_buffer';"
```

### 3. Monitoring:
```bash
# Proveri log
tail -f /var/log/smartcity_gps.log

# API status (potreban JWT token)
curl http://localhost:3010/api/gps-processor/status -H "Authorization: Bearer $TOKEN"
```

---

## 📊 Vehicle Filtering

### Samo određena vozila (WHITELIST):
```php
define('SMARTCITY_VEHICLE_FILTER_MODE', 'WHITELIST');
$SMARTCITY_VEHICLE_LIST = array('P93597', 'P93598');
// Šalje SAMO ova vozila
```

### Sva vozila osim nekih (BLACKLIST):
```php
define('SMARTCITY_VEHICLE_FILTER_MODE', 'BLACKLIST');
$SMARTCITY_VEHICLE_LIST = array('P99999');
// Šalje sve OSIM ovih
```

### Sva vozila:
```php
define('SMARTCITY_VEHICLE_FILTER_MODE', 'ALL');
// Šalje SVA vozila
```

---

## ⚠️ Važne napomene

### Sigurnost:
1. **Počinjemo sa DISABLED** - ništa se ne šalje dok ne omogućite
2. **Test sa par vozila** - koristite WHITELIST mode
3. **Postupno povećanje** - počnite sa batch size 10, pa 50
4. **Monitoring** - pratite logove prva 24h

### Performance:
- Batch size: 50 GPS tačaka
- Timeout: 3 sekunde
- Retry: 2 pokušaja
- Cron: svakih 30 sekundi

### Teltonika instance:
- Trenutno samo **teltonika60** ima integraciju
- Za ostale (61-76) kopirati iste fajlove i podesiti

---

## 📝 Checklist za produkciju

- [x] Smart City backend spreman
- [x] MySQL buffer tabela kreirana
- [x] API key konfigurisan
- [x] Legacy server skripte instalirane
- [x] Backup napravljen
- [x] Test sa SSH tunelom
- [ ] Promeni environment na PRODUCTION
- [ ] Podesi production API key
- [ ] Aktiviraj switch skriptu
- [ ] Monitor prva 24h
- [ ] Postupno uključi ostale teltonika instance

---

## 🆘 Troubleshooting

### GPS podaci se ne šalju:
1. Proveri `SMARTCITY_ENV` - mora biti LOCAL/PRODUCTION, ne DISABLED
2. Proveri API key u TimescaleDB
3. Proveri SSH tunel (za LOCAL)
4. Proveri log: `/var/log/smartcity_gps.log`

### Screen sesija ne radi:
```bash
screen -ls  # Lista sesija
screen -r teltonika60.bgnaplata  # Attach
# CTRL+A, D za detach
```

### Vraćanje na staro:
```bash
./switch_rollback.sh
```

---

## 📞 Kontakti

- Legacy server: root@79.101.48.11
- Smart City API: http://localhost:3010 (dev) / https://gsp-admin.smart-city.rs (prod)
- TimescaleDB: localhost:5433 (dev)

---

*Dokument ažuriran: 02.09.2025 13:00*
*Implementacija testirana i spremna za produkciju*