# LIVE SERVER FIX - Deployment Instructions

## 🚨 KRITIČNO: Instrukcije za deploy na LIVE server

### 📋 Pre deploy-a:

1. **Backup TimescaleDB**:
```bash
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@157.230.119.11
cd /root/backups
pg_dump -h timescale-host -U tsdbadmin -d tsdb --schema-only > schema_backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Proveri status continuous aggregates**:
```sql
-- Na live TimescaleDB
SELECT view_name, materialized_only FROM timescaledb_information.continuous_aggregates;
```

### 🚀 Deploy procedura:

#### 1. Deploy backend kod:
```bash
# Na live serveru
cd /path/to/smart-city/apps/backend
git pull origin main
npm run build
pm2 restart backend  # ili docker restart ako je container
```

#### 2. Pokreni TimescaleDB migracije:
```bash
# Na live serveru - backend directory
cd /path/to/smart-city/apps/backend/timescale
export DATABASE_URL="postgres://tsdbadmin:PASSWORD@HOST:PORT/tsdb?sslmode=require"
./bin/dbmate --migrations-dir ./migrations up
```

**VAŽNO**: Migracija `20250903180000_refresh_aggregates_live_fix.sql` će:
- ✅ Refresh-ovati sve continuous aggregates
- ✅ Dodati missing driving_events (batch detekcija za top 50 vozila)
- ✅ Ažurirati statistike
- ⏱️ Trajanje: 5-15 minuta (zavisi od količine podataka)

#### 3. Verifikacija (nakon migracije):
```sql
-- Proveri da li su aggregates OK
SELECT 
    view_name,
    materialization_hypertable_name,
    materialized_only
FROM timescaledb_information.continuous_aggregates;

-- Proveri podatke
SELECT COUNT(*) FROM vehicle_hourly_stats WHERE hour >= CURRENT_DATE - INTERVAL '7 days';
SELECT COUNT(*) FROM driving_events WHERE time >= CURRENT_DATE - INTERVAL '7 days';
```

### 🆘 Emergency opcije (ako migracija ne radi):

#### Opcija A: Manual API poziv:
```bash
# Na live serveru ili lokalno
curl -X POST https://api.smart-city.rs/api/driving-behavior/force-refresh-aggregates \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

#### Opcija B: Direct SQL (poslednja opcija):
```sql
-- Direktno na TimescaleDB
CALL refresh_continuous_aggregate('vehicle_hourly_stats', NULL, NULL);
CALL refresh_continuous_aggregate('daily_vehicle_stats', NULL, NULL);
ANALYZE vehicle_hourly_stats;
ANALYZE daily_vehicle_stats;
```

### 📊 Post-deploy verifikacija:

1. **Proveri Monthly Report**:
   - Idti na `/transport/safety/monthly-report`
   - Generiši izveštaj za vozilo P93597 (ID: 460)
   - Očekivani safety score: ~23-50 (ne više 60/100)

2. **Proveri log-ove**:
```bash
# Backend logs
tail -f /var/log/smart-city/backend.log | grep -E "(refresh|aggregate|safety)"
```

3. **Monitoring**:
   - Safety score treba da varijira po danima
   - Continuous aggregates policy treba da radi automatski
   - GPS Processor CRON treba da dodaje driving_events

### ⚠️ Rollback plan (ako nešto pođe po zlu):

```sql
-- Emergency: Deaktivacija continuous aggregate policy-ja
SELECT alter_job(job_id, scheduled => false) 
FROM timescaledb_information.jobs 
WHERE proc_name = 'policy_refresh_continuous_aggregate';

-- Povratak na osnovnu kalkulaciju
-- (safety score će biti sporiji ali funkcionalan)
```

### 🎯 Očekivani rezultati:

- **Performance**: Monthly Report 40s → <1s za 10 vozila
- **Safety Score**: Varijabilni umesto fiksni 60/100
- **Automation**: Sve future GPS podatke automatski obrađuje
- **Data**: Istorijski podaci će biti popunjeni za top 50 vozila

---

**NAPOMENA**: Ovaj fix je JEDNOVREMAN. Posle ovoga, sistem radi automatski bez potrebe za manual refresh!