# Legacy Server Scripts Backup

**Backup datum:** 11. septembar 2025  
**Ažurirano:** 11. septembar 2025 - Implementiran Safe Processor sistem  
**Izvor:** Legacy server (79.101.48.11) - teltonika70 folder  
**Napomena:** Iste skripte se koriste na svim instancama (teltonika60-76)

## ⚠️ VAŽNO: Safe Processor Implementacija (11.09.2025)
**DEPLOYED NA SVE INSTANCE (60-76)**  
Nova verzija processor-a (`smart-city-raw-processor-safe.php`) koja garantuje **zero data loss** čak i kada centralni server nije dostupan. Koristi pending queue sistem za čuvanje neuspešno poslatih podataka.

## 📁 Lista skripti:

### 1. **gps_teltonika.php**
- **Funkcija:** Glavna skripta koja prima GPS podatke sa Teltonika uređaja
- **Port:** Sluša na portu 12070 (za teltonika70)
- **Output:** Zapisuje sirove GPS podatke u MySQL i poziva `util_teltonika.php`

### 2. **util_teltonika.php** ⭐ KRITIČNA SKRIPTA
- **Funkcija:** Utility klasa za procesiranje GPS podataka
- **Opis:** Parsira binarne podatke sa Teltonika uređaja
- **Smart City integracija (linija 437-439):**
  ```php
  // Write to raw log for Smart City processing
  $gps_log = date("U") . "|" . $this->garage_no . "|" . $one_row["timestamp"] . "|" . 
            $one_row["latitude"] . "|" . $one_row["longitude"] . "|" . 
            $one_row["speed"] . "|" . $one_row["angle"] . "|" . 
            $one_row["altitude"] . "|" . $in_range . "|" . $in_range_uid . "\n";
  @file_put_contents("/var/www/teltonika70/smart-city-gps-raw-log.txt", $gps_log, FILE_APPEND | LOCK_EX);
  ```
- **Format raw log-a:** `timestamp|garage_no|gps_time|lat|lng|speed|angle|altitude|in_route|route_uid`
- **Veličina:** 29.8 KB

### 3. **smart-city-raw-processor-safe.php** ⭐ (NOVA VERZIJA)
- **Funkcija:** Procesira raw GPS log i šalje podatke na Smart City server
- **CRON:** Pokreće se svaka 2 minuta
- **Karakteristike:**
  - Batch slanje (200 tačaka po batch-u)
  - Retry mehanizam (3 pokušaja sa exponential backoff)
  - **PENDING QUEUE SISTEM** - čuva neuspešno poslate podatke
  - **TRANSAKCIONI PRISTUP** - raw → pending → processed
  - **BACKUP SISTEM** - automatski backup raw log-a pre procesiranja
  - Arhiviranje uspešno poslatih podataka u `processed_logs/godina/mesec/dan/`
  - Cleanup funkcija koja briše fajlove starije od 1 dana
  - **MAX 10,000 linija po ciklusu** za optimalnu performansu

### 3a. **smart-city-raw-processor.php** (STARA VERZIJA - backup)
- **Status:** Zamenjena sa safe verzijom, ali čuva se kao backup
- **Problem:** Gubila podatke kada server nije dostupan

### 4. **smart-city-config.php**
- **Funkcija:** Konfiguracija za Smart City integraciju
- **Sadrži:**
  - API URL-ove (produkcija i test)
  - API ključeve
  - Batch size postavke
  - Helper funkcije za slanje podataka

### 7. **smart-city-gps-vehicles.json**
- **Funkcija:** Filter vozila (mapiranje garageNumber → vehicleId)
- **Format:** `{"P93597": 460, "P93598": 461, ...}`
- **Broj vozila:** 978

### 7. **smart-city-gsp-vehicles-sync-filter.php**
- **Funkcija:** Sinhronizuje filter vozila sa Smart City serverom
- **Izvršava:** Povlači listu vozila sa API-ja i ažurira lokalni JSON

### 9. **smart-city-dashboard-api.php**
- **Funkcija:** API endpoint za dashboard statistike
- **Koristi se za:** Monitoring stanja GPS sistema

### 7. **smart-city-cron-setup.sh**
- **Funkcija:** Bash skripta za setup CRON job-ova
- **Postavlja:** Automatsko pokretanje processor skripte svaka 2 minuta

### 9. **smart-city-monitor-gps.sh**
- **Funkcija:** Monitoring skripta za GPS sistem
- **Proverava:** Status screen sesija i GPS procesa

## 🔄 Workflow (NOVI - Safe Processor):

1. **GPS prijem:** `gps_teltonika.php` prima podatke → poziva `util_teltonika.php` → zapisuje u MySQL i `smart-city-gps-raw-log.txt`
2. **Procesiranje:** CRON pokreće `smart-city-raw-processor-safe.php` svaka 2 minuta
3. **Transakcioni pristup:**
   - Raw log → Backup u `backups/` folder
   - Raw log → Prebacuje u `smart-city-gps-pending.txt`
   - Briše raw log (podaci su sigurni u pending)
4. **Slanje:** Processor čita pending → filtrira vozila → šalje na Smart City API
   - Uspešni batch-evi → Arhivira u `processed_logs/`
   - Neuspešni batch-evi → Ostaju u pending za sledeći pokušaj
5. **Cleanup:** Automatsko brisanje fajlova starijih od 1 dana (i processed_logs i backups)

## ⚙️ Deployment na druge instance:

Da bi se skripte primenile na druge instance (teltonika60-76), treba:

1. Promeniti u `util_teltonika.php` (linija 439):
   - Putanja za raw log: `/var/www/teltonika60/smart-city-gps-raw-log.txt` (prilagoditi broj)

2. Promeniti u `smart-city-config.php`:
   - `GPS_RAW_LOG` putanju (teltonika60 umesto teltonika70)
   - `PROCESSED_DIR` putanju
   - `VEHICLE_FILTER_FILE` putanju

3. Prilagoditi `gps_teltonika.php`:
   - Port broj (12060 za teltonika60, 12061 za teltonika61, itd.)

4. Pokrenuti CRON setup:
   ```bash
   ./smart-city-cron-setup.sh
   ```

## 📂 Struktura foldera na legacy serveru:

```
/var/www/teltonikaNUM/
├── smart-city-gps-raw-log.txt       # Ulazni GPS podaci (kontinuirano se puni)
├── smart-city-gps-pending.txt       # Queue za neuspešno poslate podatke (NOVO!)
├── smart-city-gps-vehicles.json     # Filter vozila
├── processed_logs/                  # Arhiva uspešno poslatih podataka
│   └── 2025/09/11/*.processed
├── backups/                         # Backup raw log-a pre procesiranja (NOVO!)
│   └── raw_*.txt
└── failed_logs/                     # Legacy folder (više se ne koristi)
```

## 📊 Cleanup statistike:

- **Čuva:** Današnje i jučerašnje podatke
- **Briše:** Sve starije od 1 dana
- **Pokreće se:** Jednom dnevno ili kad ima >1000 fajlova
- **Lock mehanizam:** Sprečava preklapanje procesa
- **Folde\ri:** processed_logs/ i backups/

## 🚨 Monitoring i Troubleshooting:

### Provera pending queue:
```bash
# Status svih instanci
for i in {60..76}; do
  echo -n "teltonika$i: "
  ssh root@79.101.48.11 "wc -l /var/www/teltonika$i/smart-city-gps-pending.txt 2>/dev/null || echo '0'"
done
```

### Provera da li processor radi:
```bash
tail -f /var/log/cron | grep smart-city-raw-processor
```

### Emergency rollback:
```bash
# Vrati staru verziju processor-a
cd /var/www/teltonika70
cp smart-city-raw-processor.php.backup-safe-* smart-city-raw-processor.php
```

## 🔐 Bezbednost:

- API ključ: `gps-legacy-key-2025-secure`
- Produkcija server: `157.230.119.11`
- Legacy server: `79.101.48.11`

## 📝 Changelog:

- **11.09.2025** - Implementiran Safe Processor sa pending queue sistemom
- **11.09.2025** - Smanjen retention period na 1 dan za sve backup-e
- **11.09.2025** - Deployment na sve instance (60-76)
- **03.09.2025** - Dodato cleanup za processed_logs folder