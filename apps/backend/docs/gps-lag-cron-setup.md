# GPS LAG Transfer - Cron Setup & Testing

## 📋 Pregled

Ovaj dokument opisuje kako podesiti automatsko procesiranje GPS podataka iz `gps_data` u `gps_data_lag_filtered` tabelu pomoću cron job-a.

## 🚀 Brzi Start

### 1. Instalacija Cron Job-a

```bash
npm run gps:cron:install
```

Ovo će instalirati cron job koji se pokreće **svakih 15 minuta** i automatski procesira nove GPS podatke.

### 2. Provera Statusa

```bash
npm run gps:cron:status
```

### 3. Praćenje Logova

```bash
npm run gps:cron:logs
```

### 4. Deinstalacija

```bash
npm run gps:cron:uninstall
```

## 📊 Monitoring

### Real-time Monitoring Dashboard

```bash
# Jednom
npm run gps:monitor

# Kontinuirano (refresh svakih 30s)
npm run gps:monitor:watch
```

Dashboard prikazuje:
- **Processing Overview**: Ukupan napredak, outlier rate, processing lag
- **Health Checks**: 5 kritičnih provera sistema
- **Vehicle Progress**: Top 10 najsporijih vozila
- **Outlier Analysis**: Analiza outlier-a po tipu i severity-ju
- **Hourly Processing Rate**: Brzina procesiranja po satima

### Web Dashboard

GPS LAG Transfer dashboard je dostupan u Admin Portal-u:

```
Menu: Vozila → GPS LAG Transfer
URL: /transport/vehicles/gps-lag-transfer
Permisija: vehicles.gps.lag:view
```

## 🧪 Testiranje

### Ručno Pokretanje Procesiranja

```bash
# Parallel processing (20 vozila odjednom)
npm run gps:process:parallel -- 20

# Parallel processing cron mode (za cron job)
npm run gps:process:parallel-cron
```

### Test Celog Dana Procesiranja

```bash
# Automatski procesuira 24 sata (sat po sat)
./scripts/test-daily-processing.sh
```

Skripta će:
- Procesirati 24 hourly batch-eva
- Prikazati napredak nakon svake 4. iteracije
- Pokazati početno i finalno stanje

### Provera Paralelnog Procesiranja

```bash
npm run gps:process:parallel-status
```

## 📝 Cron Konfiguracija

### Crontab Entry

Cron job se instalira sa ovim entry-jem:

```cron
# GPS LAG Transfer - Parallel Processing
*/15 * * * * /home/kocev/smart-city/apps/backend/scripts/cron-gps-processor.sh
```

### Cron Skripta Lokacija

```
/home/kocev/smart-city/apps/backend/scripts/cron-gps-processor.sh
```

Skripta:
- Učitava NVM i Node.js
- Pokreće parallel processing u cron modu
- Loguje sve u `logs/gps-cron/` direktorijum
- Automatski čisti stare logove (7 dana)

## 📂 Log Fajlovi

### Cron Logovi

```bash
# Lokacija
ls -lht logs/gps-cron/

# Poslednji log
tail -f logs/gps-cron/cron_*.log | tail -1
```

### Processing Logovi

Logovi su dostupni i u TimescaleDB:

```sql
-- Poslednji logovi
SELECT * FROM gps_processing_log
ORDER BY log_time DESC
LIMIT 50;

-- Logovi za specifičan batch
SELECT * FROM gps_processing_log
WHERE batch_id = 123
ORDER BY log_time;
```

## 🔧 Maintenance

### Cleanup Stale Batches

```sql
-- Očisti stale batch-eve (starije od 1h)
SELECT cleanup_stale_batches(60);
```

### Cleanup Old Logs

```sql
-- Očisti stare logove (stariji od 30 dana)
SELECT cleanup_old_logs(30);
```

### Vacuum Processing Stats

```sql
-- Vacuum tabela za bolje performanse
SELECT vacuum_processing_stats();
```

## 📈 Performance

### Trenutne Performanse (Testirano)

- **Paralelnih vozila**: 20
- **Brzina**: ~27,000 GPS tačaka po batch-u (1h)
- **Vreme**: ~5-10 sekundi po batch-u
- **Outlier rate**: 8-12%

### Optimizacija

Za bolje performanse, povećaj broj paralelnih vozila:

```bash
# 50 vozila odjednom
npm run gps:process:parallel -- 50
```

**Napomena**: Testiraj prvo da ne preopteretiš server.

## 🚨 Troubleshooting

### Cron Job Se Ne Pokreće

1. Proveri da li je instaliran:
   ```bash
   npm run gps:cron:status
   ```

2. Proveri crontab ručno:
   ```bash
   crontab -l | grep GPS
   ```

3. Proveri logove:
   ```bash
   npm run gps:cron:logs
   ```

### Procesiranje Sporo

1. Proveri health checks:
   ```bash
   npm run gps:monitor
   ```

2. Proveri outlier rate - ako je >15%, možda ima problema sa podacima

3. Povećaj broj paralelnih vozila

### Nema Novih Podataka

1. Proveri da li ima sirovnih podataka:
   ```sql
   SELECT COUNT(*) FROM gps_data
   WHERE time > NOW() - interval '1 day'
   AND NOT EXISTS (
       SELECT 1 FROM gps_data_lag_filtered f
       WHERE f.time = gps_data.time
       AND f.vehicle_id = gps_data.vehicle_id
   );
   ```

2. Proveri processing lag:
   ```bash
   npm run gps:monitor
   ```

## 📚 Dodatne Informacije

- **GPS LAG Strategy**: Pogledaj `claude-gps-lag-strategy.md` za detalje o strategiji
- **Database Functions**: Sve funkcije su u TimescaleDB migracijama
- **Monitoring Views**: 5 monitoring view-ova za različite aspekte sistema

## ⚡ Brze Komande

```bash
# Status cron job-a
npm run gps:cron:status

# Monitoring watch mode
npm run gps:monitor:watch

# Ručno procesiranje
npm run gps:process:parallel -- 20

# Test celog dana
./scripts/test-daily-processing.sh

# Cleanup
npm run gps:cron:uninstall
```
