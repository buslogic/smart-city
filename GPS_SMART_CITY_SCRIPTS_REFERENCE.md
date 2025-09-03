# GPS Smart City Integration - Referentni Dokument za Skripte

## 📅 Datum: 02.09.2025
## 📍 Server: 79.101.48.11 - teltonika60
## 👤 Autor: Smart City Development Tim

---

## 📁 Pregled Svih Fajlova i Skripti

### Lokacija: `/var/www/teltonika60/`

```
/var/www/teltonika60/
│
├── 🔧 KONFIGURACIONI FAJLOVI
│   ├── smartcity_config.inc.php       # Glavna konfiguracija
│   ├── smartcity_gps_helper.inc.php   # Helper funkcije
│   └── dbcred.inc.php                 # Modifikovan sa include
│
├── 🚀 SWITCH SKRIPTE
│   ├── switch_to_smartcity.sh         # Aktivacija Smart City
│   └── switch_rollback.sh             # Vraćanje na original
│
├── 🧪 TEST SKRIPTE
│   ├── test_integration.php           # Test integracije
│   ├── test_config_loaded.php         # Test učitavanja
│   └── test_smartcity_integration.php # Legacy test
│
├── 📝 GLAVNE SKRIPTE
│   ├── util_teltonika.php             # Trenutno aktivna verzija
│   ├── util_teltonika_ready.php       # Smart City verzija (pre switch)
│   ├── util_teltonika_main.php        # Original (posle switch)
│   └── util_teltonika_with_smartcity.php # Smart City (posle rollback)
│
└── 🔒 BACKUP FAJLOVI
    ├── util_teltonika.php.backup_20250902_123339
    ├── util_teltonika.php.backup_20250902_124743_pre_smartcity
    ├── util_teltonika_before_switch_20250902_125824.php
    └── dbcred.inc.php.backup_20250902_124321
```

---

## 🔧 Konfiguracioni Fajlovi

### 1. `smartcity_config.inc.php`

**Namena**: Glavna konfiguracija za Smart City integraciju

**Ključna podešavanja**:
```php
// Environment kontrola
define('SMARTCITY_ENV', 'DISABLED'); // DISABLED | LOCAL | STAGING | PRODUCTION

// Vehicle filtering  
define('SMARTCITY_VEHICLE_FILTER_MODE', 'WHITELIST'); // ALL | WHITELIST | BLACKLIST
$SMARTCITY_VEHICLE_LIST = array('P93597', 'P93598');

// Batch settings
define('SMARTCITY_BATCH_SIZE', 50);
define('SMARTCITY_BATCH_TIMEOUT', 3);
```

**Funkcije**:
- `smartcity_should_send_vehicle($garageNo)` - Proverava da li slati vozilo
- `smartcity_show_config()` - Prikazuje konfiguraciju
- `smartcity_log($level, $message)` - Logovanje

### 2. `smartcity_gps_helper.inc.php`

**Namena**: Helper funkcije za slanje GPS podataka

**Glavne funkcije**:
```php
smartcity_add_to_batch($garageNo, $timestamp, $lat, $lng, $speed, $course, $alt, $state, $inRoute, $imei)
smartcity_send_batch()
smartcity_flush()
smartcity_get_stats()
```

**Globalne promenljive**:
- `$smartcity_batch_buffer` - Buffer za GPS tačke
- `$smartcity_batch_count` - Broj tačaka u bufferu
- `$smartcity_stats` - Statistike slanja

### 3. `dbcred.inc.php` (modifikovan)

**Dodate linije na kraju**:
```php
// Smart City GPS Integration - Added 02.09.2025
if (file_exists(__DIR__ . "/smartcity_config.inc.php")) {
    require_once(__DIR__ . "/smartcity_config.inc.php");
}
if (file_exists(__DIR__ . "/smartcity_gps_helper.inc.php")) {
    require_once(__DIR__ . "/smartcity_gps_helper.inc.php");
}
```

---

## 🚀 Switch Skripte

### 1. `switch_to_smartcity.sh`

**Namena**: Aktivira Smart City integraciju sa minimalnim prekidom (5-10 sekundi)

**Proces**:
1. Zaustavlja screen sesiju
2. Pravi backup
3. Zamenjuje fajlove:
   - `util_teltonika.php` → `util_teltonika_main.php`
   - `util_teltonika_ready.php` → `util_teltonika.php`
4. Postavlja permissions
5. Restartuje screen sesiju

**Korišćenje**:
```bash
cd /var/www/teltonika60
./switch_to_smartcity.sh
```

### 2. `switch_rollback.sh`

**Namena**: Vraća sistem na originalnu verziju

**Proces**:
1. Zaustavlja screen sesiju
2. Vraća originalni fajl:
   - `util_teltonika_main.php` → `util_teltonika.php`
   - Ili koristi backup ako main ne postoji
3. Postavlja permissions
4. Restartuje screen sesiju

**Korišćenje**:
```bash
cd /var/www/teltonika60
./switch_rollback.sh
```

---

## 🧪 Test Skripte

### 1. `test_integration.php`

**Namena**: Testira kompletnu integraciju sa vehicle filterom

**Testira**:
- Konfiguraciju
- Vehicle filtering (WHITELIST/BLACKLIST)
- Slanje test podataka
- Statistike

**Korišćenje**:
```bash
php test_integration.php
```

**Output primer**:
```
=== TEST SMART CITY INTEGRATION ===
Environment: LOCAL
Filter Mode: WHITELIST
P93597: SEND - Should send (in whitelist)
P93599: SKIP - Should NOT send (not in whitelist)
✅ SUCCESS! Data sent to Smart City.
```

### 2. `test_config_loaded.php`

**Namena**: Proverava da li se Smart City config učitava kroz dbcred.inc.php

**Testira**:
- Konstante (SMARTCITY_ENABLED, SMARTCITY_ENV, itd.)
- Funkcije (smartcity_add_to_batch, smartcity_flush, itd.)
- Instance status

**Korišćenje**:
```bash
php test_config_loaded.php
```

### 3. `test_smartcity_integration.php`

**Namena**: Legacy test skripta za osnovnu proveru

---

## 📝 Modifikacije u `util_teltonika.php`

### Dodato nakon INSERT-a (linija ~436):
```php
// Smart City GPS Integration - Added 02.09.2025
if (function_exists("smartcity_add_to_batch")) {
    try {
        smartcity_add_to_batch(
            $this->garage_no,
            $one_row["timestamp"],
            $one_row["latitude"],
            $one_row["longitude"],
            $one_row["speed"],
            $one_row["angle"],
            $one_row["altitude"],
            $in_range,
            $in_range_uid,
            $imei
        );
    } catch (Exception $e) {
        // Ne prekidaj rad ako Smart City ne radi
    }
}
```

### Dodato pre return u saveRows() (linija ~551):
```php
// Smart City GPS Integration - Flush remaining data
if (function_exists("smartcity_flush")) {
    try {
        smartcity_flush();
    } catch (Exception $e) {
        // Ne prekidaj rad ako Smart City ne radi
    }
}
```

---

## 🔄 Stanja Fajlova

### Pre aktivacije:
- `util_teltonika.php` - Original
- `util_teltonika_ready.php` - Pripremljena Smart City verzija

### Posle switch-a:
- `util_teltonika.php` - Smart City verzija (aktivna)
- `util_teltonika_main.php` - Original (backup)

### Posle rollback-a:
- `util_teltonika.php` - Original (aktivna)
- `util_teltonika_with_smartcity.php` - Smart City verzija (backup)

---

## 🎛️ Kontrola Integracije

### Isključivanje/Uključivanje:

```bash
# Isključi (DISABLED)
sed -i "s/define('SMARTCITY_ENV', '.*');/define('SMARTCITY_ENV', 'DISABLED');/" smartcity_config.inc.php

# Uključi za lokalni test
sed -i "s/define('SMARTCITY_ENV', '.*');/define('SMARTCITY_ENV', 'LOCAL');/" smartcity_config.inc.php

# Uključi za produkciju
sed -i "s/define('SMARTCITY_ENV', '.*');/define('SMARTCITY_ENV', 'PRODUCTION');/" smartcity_config.inc.php
```

### Promena vehicle filtera:

```bash
# Samo određena vozila
sed -i "s/define('SMARTCITY_VEHICLE_FILTER_MODE', '.*');/define('SMARTCITY_VEHICLE_FILTER_MODE', 'WHITELIST');/" smartcity_config.inc.php

# Sva vozila
sed -i "s/define('SMARTCITY_VEHICLE_FILTER_MODE', '.*');/define('SMARTCITY_VEHICLE_FILTER_MODE', 'ALL');/" smartcity_config.inc.php
```

### ⚠️ ISPRAVAN PROCES AKTIVACIJE:
1. **PRVO** zameniti kod na disku (cp util_teltonika_with_smartcity.php util_teltonika.php)
2. **TEK ONDA** restartovati screen sesiju
3. **OBAVEZNO** ubiti PHP proces pri restartu (pkill -f 'teltonika60.*gps_teltonika')

---

## 📊 Monitoring i Debug

### Log fajlovi:
- `/var/log/smartcity_gps.log` - Smart City log
- `/var/www/teltonika60/teltonika.log` - Legacy GPS log

### Provera statusa:
```bash
# Da li je Smart City učitan
grep -c "smartcity" /var/www/teltonika60/util_teltonika.php

# Trenutni environment
grep "SMARTCITY_ENV" /var/www/teltonika60/smartcity_config.inc.php

# Vehicle filter
grep "SMARTCITY_VEHICLE_FILTER_MODE" /var/www/teltonika60/smartcity_config.inc.php
```

### Screen sesija:
```bash
# Status
screen -ls | grep teltonika60

# Attach (za debug)
screen -r teltonika60.bgnaplata
# CTRL+A, D za detach

# Restart
screen -XS teltonika60.bgnaplata quit
screen -m -d -S teltonika60.bgnaplata /var/www/teltonika60/start_teltonika.sh
```

---

## ⚠️ Važne Napomene

1. **UVEK praviti backup pre izmena**
2. **Početi sa DISABLED modom**
3. **Testirati sa WHITELIST i par vozila**
4. **Postupno prelaziti na ALL**
5. **Pratiti logove prva 24h**
6. **Rollback skripta uvek spremna**

---

## 🔐 Sigurnosni Prekidači

1. **SMARTCITY_ENV = 'DISABLED'** - glavna kontrola
2. **function_exists() provere** - ako funkcije nisu učitane
3. **try/catch blokovi** - ne prekidaju rad pri greški
4. **SMARTCITY_THIS_INSTANCE_ENABLED** - kontrola po instanci
5. **Vehicle filter** - kontrola koja vozila se šalju

---

*Dokument kreiran: 02.09.2025*
*Poslednje ažuriranje: 02.09.2025 13:15*
*Autor: Smart City Development Tim*