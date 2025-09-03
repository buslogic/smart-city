# 📊 GPS Legacy System - Detaljna Analiza
**Datum analize: 02.09.2025**  
**Server: 79.101.48.11 (bgnaplatagps.rs)**  
**Analizirao: Smart City Tim**

---

## 🏗️ Arhitektura Sistema

### Pregled komponenti

GPS Legacy sistem se sastoji od sledećih ključnih komponenti:

1. **Socket Server aplikacije** - PHP skripte koje slušaju na portovima
2. **Screen sesije** - Linux screen za rad u pozadini
3. **Cron zadaci** - Automatski monitoring i restart
4. **MySQL baze** - Lokalne baze za GPS podatke
5. **Teltonika direktorijumi** - 17 instanci (60-76)

---

## 📁 Struktura Direktorijuma

### Osnovna struktura
```
/var/www/
├── teltonika60/
│   ├── gps_teltonika.php         # Glavni socket server
│   ├── util_teltonika.php        # Utility klasa za obradu podataka
│   ├── dbcred.inc.php           # Database kredencijali i konfiguracija
│   ├── start_teltonika.sh       # Startup skripta
│   └── teltonika.log            # Log fajl
├── teltonika61/
├── teltonika62/
└── ... (do teltonika76)
```

### Ključni fajlovi

#### 1. **gps_teltonika.php** (265 linija)
- **Uloga**: Socket server koji prima GPS podatke
- **Port**: Definisan u dbcred.inc.php (12060 za teltonika60)
- **Klasa**: `SocketServer` - upravlja konekcijama
- **Funkcija**: Kontinuirano sluša i prima GPS podatke sa Teltonika uređaja

#### 2. **util_teltonika.php** (692 linije)
- **Uloga**: Obrada i čuvanje GPS podataka
- **Ključna funkcija**: `saveRows()` (linija 300-500)
- **INSERT lokacija**: Linija 433-434
- **Dodatne funkcije**: 
  - Provera stanica i ruta
  - Praćenje brzine
  - IO događaji sa vozila

#### 3. **dbcred.inc.php**
```php
// MySQL kredencijali
define("DB_SERVER", "79.101.48.10");       // Legacy glavni server
define("DB_USER", "ilija");
define("DB_PASS", "Stefan5656!");
define("DB_GLOBAL", "global");

// Lokalni GPS server
define("DB_SERVER_GPS", "localhost");
define("DB_USER_GPS", "ilija");
define("DB_PASS_GPS", "Stefan5656!");

// Socket konfiguracija
$port_address = 12060;  // Port za teltonika60
$server_address = '79.101.48.11';
```

---

## 🔄 Mehanizam Rada

### 1. Prijem GPS podataka

```mermaid
graph LR
    A[Teltonika uređaj] -->|TCP Socket| B[Port 12060]
    B --> C[gps_teltonika.php]
    C --> D[util_teltonika.php]
    D --> E[MySQL baza]
```

**Proces:**
1. Teltonika uređaj šalje GPS podatke na određeni port
2. Socket server (`gps_teltonika.php`) prima podatke
3. Podaci se prosleđuju `util_teltonika` klasi
4. Klasa obrađuje i validira podatke
5. Podaci se čuvaju u MySQL bazu

### 2. Obrada podataka u saveRows() funkciji

**Lokacija**: `/var/www/teltonika60/util_teltonika.php`, linija 300-500

**Tok obrade:**
```php
public function saveRows($data_array, $imei) {
    // 1. Provera MySQL konekcije
    $this->checkMYSQL();
    
    // 2. Učitavanje stanica i ruta
    if ($this->ranges_loaded == 0) {
        // Učitava podatke o stanicama
    }
    
    // 3. Provera trenutne linije vozila
    $q = "SELECT line_number FROM current WHERE garageNo='".$this->garage_no."'";
    
    // 4. Za svaki GPS point
    foreach ($data_array as $one_row) {
        // Provera da li je vozilo blizu stanice
        $in_range = 0;
        $in_range_uid = 0;
        
        // 5. INSERT u bazu (linija 433)
        $q = "INSERT INTO `".$this->garage_no."gps` SET 
              captured='".$one_row['timestamp']."',
              lat='".$one_row['latitude']."',
              lng='".$one_row['longitude']."',
              course='".$one_row['angle']."',
              speed='".$one_row['speed']."',
              alt='".$one_row['altitude']."',
              `inroute`='".$in_range_uid."',
              `state`='".$in_range."'";
        
        $result = mysqli_query($this->mysqli_link_gps, $q);
        
        if ($result) {
            $counter++;
            // ⚠️ OVDE TREBA DODATI SMART CITY INTEGRACIJU
        }
    }
}
```

---

## 🤖 Automatizacija i Monitoring

### Cron zadaci

#### 1. **Monitoring skripta** (svaki minut)
```bash
*/1 * * * * /usr/bin/flock -n /var/lock/teltonika60.lock /root/bin/teltonikacheck60.sh
```

**Skripta: `/root/bin/teltonikacheck60.sh`**
```bash
#!/bin/bash
# Provera screen sesije
if screen -ls | grep "teltonika60.bgnaplata*"; then
    echo "screen radi"
else
    echo "screen ne radi"
    screen -wipe
    screen -XS teltonika60.bgnaplata quit
    screen -m -d -S teltonika60.bgnaplata /var/www/teltonika60/start_teltonika.sh
fi

# Provera PHP procesa
nb=$(ps aux | grep -c "gps_teltonika*")
if [ $nb -ge 2 ]; then
    echo "skripta radi"
else
    echo "skripta ne radi"
    # Restart
    screen -XS teltonika60.bgnaplata quit
    screen -m -d -S teltonika60.bgnaplata /var/www/teltonika60/start_teltonika.sh
fi
```

#### 2. **Dnevni restart** (00:12)
```bash
12 0 */1 * * /usr/bin/flock -n /var/lock/teltonika60.lock /root/bin/teltonikascreenrestart60.sh
```

**Razlog**: Čišćenje memory leak-ova i reset konekcija

### Screen sesije

**Lista aktivnih sesija:**
```bash
screen -ls
# Output:
# 2606689.teltonika60.bgnaplata (Detached)
# 2606695.teltonika61.bgnaplata (Detached)
# ... itd
```

**Pristupanje sesiji:**
```bash
screen -r teltonika60.bgnaplata
```

---

## 📊 Database struktura

### GPS tabele

Svako vozilo ima svoju tabelu sa formatom: `{garageNo}gps`

**Primer: `P93597gps`**
```sql
CREATE TABLE `P93597gps` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `captured` datetime NOT NULL,
    `lat` decimal(10,8) DEFAULT NULL,
    `lng` decimal(11,8) DEFAULT NULL,
    `course` int(11) DEFAULT NULL,
    `speed` int(11) DEFAULT NULL,
    `alt` int(11) DEFAULT NULL,
    `inroute` int(11) DEFAULT '0',
    `state` int(11) DEFAULT '0',
    PRIMARY KEY (`id`),
    UNIQUE KEY `captured` (`captured`)
);
```

### Dodatne tabele
- `current` - trenutno stanje vozila
- `between_stations_time` - vreme između stanica
- `gps_speeding` - prekoračenja brzine
- `{garageNo}iot` - IoT događaji sa vozila

---

## 🔌 Portovi i konekcije

### Port mapiranje
```
teltonika60 → Port 12060
teltonika61 → Port 12061
teltonika62 → Port 12062
...
teltonika76 → Port 12076
```

### Firewall pravila
```bash
# Provera otvorenih portova
netstat -tulpn | grep :1206
```

---

## 🎯 Tačka integracije za Smart City

### Gde dodati kod

**Fajl**: `/var/www/teltonika60/util_teltonika.php`  
**Funkcija**: `saveRows()`  
**Linija**: 435 (odmah posle uspešnog INSERT-a)

### Preporučeni pristup

```php
// Nakon linije 434
$result = mysqli_query($this->mysqli_link_gps, $q);
if ($result) {
    $counter++;
    
    // Smart City Integration - Added 2025-09-02
    if (defined('SMARTCITY_API_ENABLED') && SMARTCITY_API_ENABLED) {
        // Opcija 1: Pojedinačno slanje
        // $this->sendToSmartCity($one_row, $imei);
        
        // Opcija 2: Batch slanje (preporučeno)
        $this->addToSmartCityBatch($one_row, $imei, $one_row['io'] ?? []);
    }
}
```

---

## ⚠️ Važne napomene

### Sigurnost
1. **Ne prekidati postojeći rad** - Sve izmene moraju biti backward compatible
2. **Async slanje** - Ne blokirati prijem GPS podataka
3. **Error handling** - Greške ne smeju da sruše sistem
4. **Backup pre izmena** - Obavezno backup util_teltonika.php

### Performance
- Sistem prima ~1000 GPS tačaka po vozilu dnevno
- 17 paralelnih instanci (teltonika60-76)
- Svaka instanca upravlja sa ~10-50 vozila
- Ukupno: ~500-800 vozila aktivno

### Maintenance
- Log rotacija nije implementirana (teltonika.log može da naraste)
- Screen sesije se restartuju dnevno
- Cron monitoring svaki minut

---

## 📝 Checklist za implementaciju

### Pre početka
- [ ] SSH pristup na 79.101.48.11
- [ ] Backup svih util_teltonika.php fajlova
- [ ] Backup svih dbcred.inc.php fajlova
- [ ] API key od Smart City tima

### Implementacija
- [ ] Dodati SMARTCITY konstante u dbcred.inc.php
- [ ] Dodati funkcije u util_teltonika.php
- [ ] Testirati sa jednom instancom (teltonika60)
- [ ] Monitor 1 sat
- [ ] Postepeno uključiti ostale instance

### Post-implementacija
- [ ] Proveriti da legacy sistem radi normalno
- [ ] Proveriti da Smart City prima podatke
- [ ] Dokumentovati sve izmene
- [ ] Postaviti monitoring

---

## 🔧 Korisne komande

### Provera statusa
```bash
# Lista SVIH screen sesija
screen -ls

# Broj aktivnih teltonika sesija
screen -ls | grep -c 'teltonika.*bgnaplata'

# Lista teltonika screen sesija (sortirane)
screen -ls | grep 'teltonika.*bgnaplata' | sort -t'.' -k2 -V

# Provera PHP procesa
ps aux | grep gps_teltonika | grep -v grep

# Provera porta
netstat -tulpn | grep 12060

# Praćenje loga
tail -f /var/www/teltonika60/teltonika.log

# Provera cron zadataka
crontab -l | grep teltonika
```

### Upravljanje screen sesijama

#### Zaustavljanje sesije
```bash
# Metod 1: Direktno ubijanje screen sesije
screen -XS teltonika60.bgnaplata quit

# Metod 2: Prvo wipe pa quit (sigurniji)
screen -wipe
screen -XS teltonika60.bgnaplata quit

# Metod 3: Kill preko PID-a (ako je zaglavljena)
screen -ls | grep teltonika60
# Uzmi PID (prvi broj, npr. 2606689) i kill
kill -9 2606689
```

#### Pokretanje sesije
```bash
# Standardni način pokretanja
screen -m -d -S teltonika60.bgnaplata /var/www/teltonika60/start_teltonika.sh

# Opcije:
# -m = start screen u "detached" modu
# -d = detach odmah
# -S = ime sesije
```

#### Kompletni restart (zaustavlja i pokreće)
```bash
# Za jednu sesiju
screen -XS teltonika60.bgnaplata quit
sleep 2
screen -m -d -S teltonika60.bgnaplata /var/www/teltonika60/start_teltonika.sh

# Ili koristi postojeću skriptu
/root/bin/teltonikascreenrestart60.sh
```

#### Restart više sesija odjednom
```bash
# Primer za teltonika 60, 61, 62
for i in 60 61 62; do
    echo "Restartujem teltonika$i..."
    screen -XS teltonika$i.bgnaplata quit
    sleep 1
    screen -m -d -S teltonika$i.bgnaplata /var/www/teltonika$i/start_teltonika.sh
    sleep 2
done

# Provera da li su pokrenute
screen -ls | grep teltonika | grep -E '60|61|62'
```

### Pristupanje screen sesiji (za debug)
```bash
# Pristup sesiji (interaktivni mod)
screen -r teltonika60.bgnaplata

# VAŽNO: Za izlaz iz screen sesije bez prekidanja:
# Pritisni CTRL+A, zatim D (detach)
# NIKAKO ne koristiti CTRL+C ili exit!

# Ako je sesija "Attached" (neko već gleda)
screen -d -r teltonika60.bgnaplata  # Force detach i attach

# Pregled sadržaja bez pristupanja
screen -S teltonika60.bgnaplata -X hardcopy /tmp/screen60.txt
cat /tmp/screen60.txt
```

### Monitoring integracije
```bash
# Grep za Smart City logove (kada bude implementirano)
tail -f /var/www/teltonika60/teltonika.log | grep -i smartcity

# Provera curl procesa
ps aux | grep curl | grep smart-city

# Real-time praćenje svih teltonika logova
tail -f /var/www/teltonika*/teltonika.log
```

### Privremeno zaustavljanje cron monitoring-a
```bash
# Ako želite da sesija ostane zaustavljena
# (inače će cron je pokrenuti za 1 minut)

# Zakomentariši liniju u crontab
crontab -e
# Dodaj # ispred linije:
# */1 * * * * /usr/bin/flock -n /var/lock/teltonika60.lock /root/bin/teltonikacheck60.sh

# Ili privremeno premesti skriptu
mv /root/bin/teltonikacheck60.sh /root/bin/teltonikacheck60.sh.disabled

# Za vraćanje
mv /root/bin/teltonikacheck60.sh.disabled /root/bin/teltonikacheck60.sh
```

---

## 📞 Kontakti

- **Legacy sistem admin**: root@79.101.48.11
- **Database server**: 79.101.48.10
- **Smart City API**: adminapi.smart-city.rs

---

## 📚 Dodatne informacije

### Screen sesije - trenutni status (02.09.2025)
- **Aktivne sesije**: 17 (teltonika60 - teltonika76)
- **Status**: Sve u "Detached" modu
- **Automatski monitoring**: Cron svaki minut
- **Dnevni restart**: 00:12 svaki dan

### Testirana funkcionalnost
- ✅ Restart teltonika60 sesije uspešno izvršen
- ✅ Novi PID: 3204349 (prethodni: 2606689)
- ✅ Automatsko pokretanje radi

---

*Dokument kreiran: 02.09.2025*  
*Poslednje ažuriranje: 02.09.2025 - Dodaćene komande za upravljanje screen sesijama*  
*Verzija: 1.1*  
*Autor: Smart City Development Tim*