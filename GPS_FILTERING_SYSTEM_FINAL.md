# GPS Vehicle Filtering System - Finalna Dokumentacija

## 📅 Implementirano: 03.09.2025
## ✅ Status: PRODUKCIJSKI SPREMAN

---

## 🎯 Pregled Sistema

Sistem filtrira GPS podatke sa legacy servera tako da procesira **samo vozila koja postoje u našoj bazi** (978 od ~2000 vozila).

### Tok Podataka:
```
Legacy GPS (2000 vozila) → Raw Log → Filter (978 vozila) → MySQL Buffer → TimescaleDB
       ↓                      ↓           ↓                    ↓              ↓
   Teltonika              5 minuta    44% prihvaćeno      30 sekundi    Finalno skladište
```

### Ključne Statistike:
- **56% podataka se odbacuje** (vozila koja nisu u našoj bazi)
- **144 GPS uređaja** aktivno šalje podatke
- **~10,000 GPS tačaka** po 5-minutnom ciklusu
- **Maksimalno kašnjenje**: 5 min 30 sek

---

## 📁 Implementirane Komponente

### 1. Legacy Server (79.101.48.11)

#### Fajlovi:
```
/var/www/teltonika60/
├── util_teltonika.php                    # Glavna skripta (modifikovana)
├── smart-city-raw-processor.php          # Processor sa filterom
├── smart-city-gsp-vehicles-sync-filter.php # Sync lista vozila
├── smart-city-gsp-vehicles.json          # Filter sa 978 vozila
├── smart-city-monitor-gps.sh             # Monitoring skripta
├── smart-city-gps-raw-log.txt            # Trenutni raw log
└── processed_logs/                       # Arhiva procesiranih logova
```

#### Cron Jobs:
```bash
# Procesiranje raw log-a svakih 2 minuta
*/2 * * * * /usr/bin/php /var/www/teltonika60/smart-city-raw-processor.php >> /var/log/smart-city-raw-processor.log 2>&1
```

### 2. Backend (Smart City)

#### Novi Endpoint:
- `GET /api/vehicles-gps/export` - Export aktivnih vozila za GPS
- Zaštićen sa API key: `gps-sync-key-2025`
- Vraća JSON sa `id` i `garageNumber` za svako vozilo

#### GPS Processor Service:
- Cron: **svakih 30 sekundi**
- Deduplicacija po `vehicle_id + timestamp`
- Boolean konverzija za `in_route`
- Batch procesiranje do 1000 tačaka

### 3. Baze Podataka

#### MySQL Buffer (`gps_raw_buffer`):
- Privremeno skladište GPS podataka
- Automatsko brisanje nakon uspešnog transfera

#### TimescaleDB:
- Finalno skladište sa PostGIS ekstenzijama
- Hypertable sa automatskom particijom po danima
- Unique constraint na `(vehicle_id, time)`

---

## 🔧 Konfiguracija

### Vehicle Filter Sync:
```bash
# Ručno sinhronizovanje liste vozila
ssh root@79.101.48.11
php /var/www/teltonika60/smart-city-gsp-vehicles-sync-filter.php
```

### Monitoring:
```bash
# Proveri status sistema
ssh root@79.101.48.11
./smart-city-monitor-gps.sh
```

Output pokazuje:
- Broj linija u trenutnom log-u
- Broj jedinstvenih vozila
- Broj vozila u filteru
- Statistike procesiranja
- Broj aktivnih GPS konekcija

---

## 📊 Performanse

### Prosečno po ciklusu (5 minuta):
- **Generiše se**: 10,000-20,000 GPS tačaka
- **Filtrira se**: ~56% (vozila nisu u našoj bazi)
- **Procesira se**: ~4,400 tačaka
- **Vozila**: 50-60 aktivnih

### Opterećenje:
- Legacy server: Minimalno (samo pisanje u fajl)
- Backend API: 1 request na 5 minuta
- MySQL: ~1000 INSERT-a po minuti
- TimescaleDB: Batch INSERT svakih 30 sekundi

---

## 🚨 Troubleshooting

### Problem: Podaci ne stižu u TimescaleDB
```bash
# Proveri MySQL buffer
docker exec smartcity-mysql-local mysql -u smartcity_user -pSecurePassword123! smartcity_dev \
  -e "SELECT process_status, COUNT(*) FROM gps_raw_buffer GROUP BY process_status;"

# Proveri backend log
docker logs backend-app | grep GpsProcessor
```

### Problem: Filter ne radi
```bash
# Proveri da li filter postoji
ssh root@79.101.48.11 'wc -l /var/www/teltonika60/vehicle_filter.json'

# Re-sync filter
ssh root@79.101.48.11 'php /var/www/teltonika60/sync_vehicle_filter.php'
```

### Problem: Raw log raste preveliki
```bash
# Proveri veličinu log-a
ssh root@79.101.48.11 'ls -lh /var/www/teltonika60/smart-city-gps-raw-log.txt'

# Ručno procesiranje
ssh root@79.101.48.11 'php /var/www/teltonika60/smart-city-raw-processor.php'

# Proveri cron
ssh root@79.101.48.11 'crontab -l | grep smart-city-raw-processor'
```

---

## ✅ Checklist za Produkciju

- [x] Vehicle filter implementiran i testiran
- [x] Processor filtrira vozila koja nisu u bazi
- [x] Timestamp konverzija ispravna
- [x] Boolean konverzija za in_route
- [x] Deduplicacija duplikata
- [x] Cron job postavljen
- [x] Monitoring skripta kreirana
- [x] Backup sistem za procesirane logove
- [ ] Alerting sistem (opciono)
- [ ] Log rotacija za processor log (opciono)

---

## 📈 Buduća Unapređenja

1. **Real-time sync vozila** - Webhook kada se doda/ukloni vozilo
2. **Compression** - Kompresija processed logova posle 7 dana
3. **Alerting** - Slack/email ako processor fail-uje
4. **Dashboard** - Grafana za monitoring GPS podataka
5. **Optimization** - Smanjiti cron na 1 minut za brži response

---

## 📞 Kontakti i Pristup

- Legacy Server: `ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11`
- Backend API: `http://localhost:3010` (dev) / `https://gsp-admin.smart-city.rs` (prod)
- MySQL: `mysql://smartcity_user:SecurePassword123!@localhost:3325/smartcity_dev`
- TimescaleDB: `postgres://smartcity_ts:smartcity_ts@localhost:5433/smartcity_gps`

---

*Dokumentacija kreirana: 03.09.2025*
*Autor: Smart City Development Tim*