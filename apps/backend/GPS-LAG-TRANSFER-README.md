# 🚀 GPS LAG Transfer - Automatsko Procesiranje

Automatski transfer i procesiranje GPS podataka iz `gps_data` u `gps_data_lag_filtered` tabelu sa LAG() kalkulacijama i outlier detekcijom.

## ✅ Šta je Implementirano

### 🔧 Infrastruktura
- ✅ TimescaleDB funkcije za batch procesiranje
- ✅ Parallel processing sa advisory locks
- ✅ PostgreSQL funkcije za monitoring i maintenance
- ✅ Cron job setup za automatsko procesiranje

### 📊 Monitoring & Dashboard
- ✅ CLI monitoring tool (`npm run gps:monitor`)
- ✅ Web dashboard u Admin Portal (`Vozila → GPS LAG Transfer`)
- ✅ 5 monitoring view-ova (overview, daily stats, vehicle progress, outlier analysis, hourly rate)
- ✅ 5 health checks (lag, failed batches, outlier rate, stale batches, processing rate)

### 🎯 Processing
- ✅ Continuous processing mode
- ✅ Parallel processing (do 50 vozila odjednom)
- ✅ Automatic error recovery
- ✅ Batch retry mehanizam

### 📝 Dokumentacija
- ✅ Cron setup guide (`docs/gps-lag-cron-setup.md`)
- ✅ GPS LAG strategy (`claude-gps-lag-strategy.md`)
- ✅ GPS aggregates guide (`claude-gps-aggregates.md`)

## 🚀 Brzi Start

### 1. Instalacija Cron Job-a

```bash
cd /home/kocev/smart-city/apps/backend
npm run gps:cron:install
```

**Cron schedule**: Svakih 15 minuta
**Max parallel**: 5 vozila (default)

### 2. Provera Statusa

```bash
npm run gps:cron:status
```

### 3. Monitoring

```bash
# Jednom
npm run gps:monitor

# Watch mode (refresh svakih 30s)
npm run gps:monitor:watch
```

### 4. Web Dashboard

Otvori Admin Portal:
```
Menu: Vozila → GPS LAG Transfer
Permisija: vehicles.gps.lag:view
```

## 📊 Trenutno Stanje

**Procesuirano**: 57,409 GPS tačaka (0.07% od 79M)
**Vozila**: 32 vozila
**Outliers**: 4,759 (8.29%)
**Processing Lag**: 24 dana

## 🧪 Testiranje

### Ručno Procesiranje

```bash
# Parallel processing - 20 vozila odjednom
npm run gps:process:parallel -- 20

# Parallel processing - 50 vozila odjednom (brže)
npm run gps:process:parallel -- 50
```

### Test Celog Dana

```bash
npm run gps:test:daily
```

Procesuira 24 hourly batch-eva sat po sat.

### Status Paralelnog Procesiranja

```bash
npm run gps:process:parallel-status
```

## 📈 Performanse

**Trenutne performanse** (20 vozila paralelno):
- ~27,000 GPS tačaka po batch-u (1 sat)
- ~5-10 sekundi po batch-u
- Outlier rate: 8-12%

**Projekcija za ceo dataset** (79M tačaka):
- Sa 20 vozila: ~7-10 dana
- Sa 50 vozila: ~3-5 dana
- Sa continuous cron (15min interval): ~2-3 nedelje

## 🔧 Komande

### Cron Management
```bash
npm run gps:cron:install     # Instaliraj cron job
npm run gps:cron:uninstall   # Deinstaliraj cron job
npm run gps:cron:status      # Status cron job-a
npm run gps:cron:logs        # Poslednji log
```

### Processing
```bash
npm run gps:process:parallel          # Parallel (default 5)
npm run gps:process:parallel -- 20    # Parallel (20 vozila)
npm run gps:process:parallel-cron     # Cron mode
npm run gps:process:parallel-status   # Status
```

### Monitoring
```bash
npm run gps:monitor          # Monitoring jednom
npm run gps:monitor:watch    # Watch mode (30s refresh)
```

### Testing
```bash
npm run gps:test:daily       # Test celog dana (24h)
```

## 📂 Lokacije Fajlova

### Scripts
- `/scripts/cron-gps-processor.sh` - Cron wrapper skripta
- `/scripts/setup-cron.sh` - Cron setup helper
- `/scripts/test-daily-processing.sh` - Test skripta
- `/scripts/monitor-gps-processing.ts` - Monitoring tool

### Processing Engine
- `/src/gps-processor/batch-processor.ts` - Glavni processor

### TimescaleDB Migracije
- `/timescale/migrations/20251003192450_create_process_gps_batch_functions.sql`
- `/timescale/migrations/20251003202329_parallel_processing_functions.sql`
- `/timescale/migrations/20251003203350_monitoring_and_maintenance.sql`

### Logovi
- `/logs/gps-cron/` - Cron execution logovi

### Dokumentacija
- `/docs/gps-lag-cron-setup.md` - Cron setup guide
- `/claude-gps-lag-strategy.md` - Strategy document
- `/claude-gps-aggregates.md` - Aggregates guide

## 🏥 Health Checks

Sistem automatski prati 5 health checks:

1. **Processing Lag** - Razlika između najnovijih i poslednjих procesuiranih podataka
2. **Failed Batch Rate** - Procenat neuspešnih batch-eva (24h)
3. **Outlier Rate** - Procenat outlier-a (24h) - OK: <10%, WARNING: 10-15%, CRITICAL: >15%
4. **Stale Batches** - Broj "zaglavljenih" batch-eva (>1h u processing statusu)
5. **Processing Rate** - Broj redova i batch-eva procesuiranih u poslednjih sat vremena

## 🔍 Monitoring View-ovi

### v_processing_overview
Ukupan napredak procesiranja

### v_daily_processing_stats
Dnevna statistika po danima

### v_vehicle_processing_progress
Napredak po vozilima (top 10 najsporijih)

### v_outlier_analysis
Analiza outlier-a po tipu i severity-ju

### v_hourly_processing_rate
Brzina procesiranja po satima (poslednja 24h)

## 🛠️ Maintenance Funkcije

### Cleanup Stale Batches
```sql
SELECT cleanup_stale_batches(60);  -- Očisti batch-eve starije od 60min
```

### Cleanup Old Logs
```sql
SELECT cleanup_old_logs(30);  -- Očisti logove starije od 30 dana
```

### Vacuum Processing Stats
```sql
SELECT vacuum_processing_stats();  -- Optimizuj tabele
```

## 📚 Dodatna Dokumentacija

- **Cron Setup**: `docs/gps-lag-cron-setup.md`
- **GPS LAG Strategy**: `claude-gps-lag-strategy.md`
- **GPS Aggregates**: `claude-gps-aggregates.md`

## 🚨 Troubleshooting

### Cron ne radi
```bash
# Proveri status
npm run gps:cron:status

# Proveri logove
npm run gps:cron:logs

# Reinstaliraj
npm run gps:cron:uninstall
npm run gps:cron:install
```

### Procesiranje sporo
- Povećaj broj paralelnih vozila (`npm run gps:process:parallel -- 50`)
- Proveri health checks (`npm run gps:monitor`)
- Proveri outlier rate - ako >15%, možda ima problema sa podacima

### Nema novih podataka
```bash
# Proveri monitoring
npm run gps:monitor

# Proveri health checks
```

## ⚡ Next Steps

Prema `claude-gps-lag-strategy.md` TODO listi, sledeći koraci su:

- [ ] 4.2 Postaviti systemd servis (alternativa cron-u)
- [ ] 4.4 Implementirati health check endpoint u API-ju
- [ ] 4.5 Postaviti alerting (email/Slack)
- [ ] 5.1-5.5 Kreirati continuous aggregates (5-minute, hourly, daily)
- [ ] 6.2 Test prekida i recovery
- [ ] 6.4 Performance test (1 milion redova)
- [ ] 8.1-8.5 Production Deployment

## 📞 Podrška

Za pitanja i probleme, proveri:
1. Monitoring dashboard (`npm run gps:monitor`)
2. Health checks
3. Logove (`npm run gps:cron:logs`)
4. Dokumentaciju u `/docs` i `claude-*.md` fajlovima
