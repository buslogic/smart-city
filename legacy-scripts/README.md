# Smart City GPS Legacy Integration Scripts

## 📋 Pregled

Ove skripte omogućavaju integraciju legacy GPS sistema sa Smart City platformom, sa mogućnošću slanja podataka na produkciju i/ili test server istovremeno.

## 🚀 Karakteristike

- **Dual-server support**: Može slati podatke na produkciju i test server istovremeno
- **Lako upravljanje**: Jednostavno uključivanje/isključivanje test servera
- **Vehicle filtering**: Procesira samo vozila koja postoje u Smart City bazi
- **Batch processing**: Efikasno slanje podataka u batch-evima od 200 tačaka
- **Error handling**: Automatski retry za produkciju server
- **Arhiviranje**: Automatsko arhiviranje obrađenih fajlova

## 📁 Fajlovi

```
legacy-scripts/
├── smart-city-config.php           # Glavna konfiguracija
├── smart-city-raw-processor-v2.php # Processor skripta
├── smart-city-toggle-test.php      # Upravljanje test serverom
└── README.md                        # Ova dokumentacija
```

## 🔧 Instalacija na Legacy Server

1. **Kopiraj skripte na legacy server:**
```bash
# Sa development servera
scp -i ~/.ssh/hp-notebook-2025-buslogic \
    /home/kocev/smart-city/legacy-scripts/*.php \
    root@79.101.48.11:/var/www/teltonika60/
```

2. **Postavi izvršne dozvole:**
```bash
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11
chmod +x /var/www/teltonika60/smart-city-toggle-test.php
```

3. **Proveri status:**
```bash
php /var/www/teltonika60/smart-city-toggle-test.php status
```

## 🎮 Upravljanje Test Serverom

### Uključivanje test servera
```bash
php smart-city-toggle-test.php on
```

### Isključivanje test servera
```bash
php smart-city-toggle-test.php off
```

### Provera statusa
```bash
php smart-city-toggle-test.php status
```

### Postavljanje SSH tunnel-a
Na legacy serveru:
```bash
# Pokreni SSH tunnel ka development serveru
ssh -L 3010:localhost:3010 root@164.92.200.100 -N &

# Ili u screen sesiji
screen -S tunnel
ssh -L 3010:localhost:3010 root@164.92.200.100 -N
# Ctrl+A, D za detach

# Postavi test server da koristi tunnel
php smart-city-toggle-test.php tunnel
```

## 🔄 Workflow

### Normalan rad (samo produkcija)
```bash
# Test server je po defaultu isključen
php smart-city-toggle-test.php status
# Test Server: 🔴 DISABLED
# Data će ići samo na produkciju
```

### Testiranje (produkcija + test)
```bash
# 1. Pokreni SSH tunnel na legacy serveru
ssh -L 3010:localhost:3010 root@164.92.200.100 -N &

# 2. Uključi test server
php smart-city-toggle-test.php on

# 3. Postavi URL za tunnel
php smart-city-toggle-test.php tunnel

# 4. Proveri status
php smart-city-toggle-test.php status
# Test Server: ✅ ENABLED
# SSH Tunnel: ✅ Active on port 3010

# Data će sada ići na OBA servera
```

### Vraćanje na produkciju
```bash
# Isključi test server
php smart-city-toggle-test.php off

# Zatvori SSH tunnel
killall ssh  # ili nađi PID i kill
```

## 📊 Monitoring

### Praćenje logova
```bash
# Praćenje grešaka
tail -f /var/www/teltonika60/smart-city-errors.log

# Praćenje raw log-a
tail -f /var/www/teltonika60/smart-city-gps-raw-log.txt

# Praćenje processor-a
php /var/www/teltonika60/smart-city-raw-processor-v2.php
```

### Test procesiranja
```bash
# Pokreni processor ručno
php /var/www/teltonika60/smart-city-raw-processor-v2.php
```

## ⚙️ Konfiguracija

Glavne postavke u `smart-city-config.php`:

```php
// Production (uvek aktivan)
define('PROD_API_URL', 'http://157.230.119.11/api');
define('PROD_ENABLED', true);

// Test (može se uključiti/isključiti)
define('TEST_ENABLED', false);  // Menja smart-city-toggle-test.php
define('TEST_API_URL', 'http://localhost:3010/api');

// Batch postavke
define('BATCH_SIZE', 200);
define('MAX_RETRIES', 3);
```

## 🐛 Troubleshooting

### Problem: Test server ne prima podatke
```bash
# Proveri SSH tunnel
ss -tlnp | grep 3010

# Proveri da li je test server uključen
php smart-city-toggle-test.php status

# Proveri da li dev server radi
curl http://localhost:3010/api/health
```

### Problem: Production server ne prima podatke
```bash
# Test konekcije
curl -I http://157.230.119.11/api/health

# Proveri API key
curl -H "x-api-key: gps-sync-key-2025" \
     http://157.230.119.11/api/vehicles-gps/export | head
```

### Problem: Vehicle filter je prazan
```bash
# Ručno učitaj filter
curl -H "x-api-key: gps-sync-key-2025" \
     http://157.230.119.11/api/vehicles-gps/export \
     > /var/www/teltonika60/smart-city-gps-vehicles.json
```

## 🔐 Sigurnost

- API key je hardkodovan ali može se promeniti u config fajlu
- SSH tunnel koristi privatni ključ autentifikaciju
- Produkcija server je uvek prioritet (retry logic)
- Test server greške ne blokiraju produkciju

## 📝 Cron Setup

```bash
# Procesiranje svakih 2 minuta
*/2 * * * * /usr/bin/php /var/www/teltonika60/smart-city-raw-processor-v2.php >> /var/log/smart-city-processor.log 2>&1

# Sync vehicle filter svakih 2 sata
0 */2 * * * /usr/bin/php /var/www/teltonika60/smart-city-gps-vehicles-sync-filter.php >> /var/log/smart-city-sync.log 2>&1
```

## ✅ Checklist za produkciju

- [ ] Kopiraj skripte na legacy server
- [ ] Proveri da TEST_ENABLED = false
- [ ] Proveri produkciju URL i API key
- [ ] Testiraj vezu sa produkcijom
- [ ] Postavi cron job-ove
- [ ] Monitoriši prve sate rada