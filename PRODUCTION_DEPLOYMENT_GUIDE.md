# Production Deployment Guide - GPS Vehicle Filtering System

## 📋 Pre-deployment Checklist

- [x] Kod je commit-ovan i push-ovan na GitHub
- [ ] Production server je dostupan (157.230.119.11)
- [ ] Backup postojećih podataka je napravljen
- [ ] Environment varijable su spremne za produkciju

## 🚀 Deployment Koraci

### 1. SSH na Production Server

```bash
ssh root@157.230.119.11
```

### 2. Pull Latest Changes

```bash
cd /root/smart-city
git pull origin main
```

### 3. Install Dependencies

```bash
# Backend dependencies
cd apps/backend
npm install

# Regenerate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy
```

### 4. Update Environment Variables

```bash
# Backend .env file
nano apps/backend/.env
```

Proveri sledeće varijable:
```env
DATABASE_URL="mysql://smartcity:password@localhost:3306/smartcity"
TIMESCALE_URL="postgresql://smartcity_ts:password@localhost:5432/smartcity_gps"
JWT_SECRET="production-secret-key"
JWT_REFRESH_SECRET="production-refresh-secret"
NODE_ENV=production
PORT=3010

# GPS Sync
GPS_SYNC_API_KEY="gps-sync-key-2025"
LEGACY_GPS_API_URL="http://157.230.119.11:8080"
```

### 5. Build Backend

```bash
cd /root/smart-city/apps/backend
npm run build
```

### 6. Setup PM2 Process Manager

```bash
# Install PM2 if not installed
npm install -g pm2

# Start backend with PM2
pm2 start dist/main.js --name smart-city-backend

# Save PM2 configuration
pm2 save
pm2 startup
```

### 7. Configure Legacy Server Integration

SSH na legacy server (ako je različit):
```bash
ssh root@legacy-server-ip
```

Update configuration:
```bash
cd /var/www/teltonika60

# Update smart-city-gps-vehicles-sync-filter.php
nano smart-city-gps-vehicles-sync-filter.php
# Promeni API URL na production: http://157.230.119.11:3010

# Update smart-city-raw-processor.php
nano smart-city-raw-processor.php
# Promeni API URL na production: http://157.230.119.11:3010
```

### 8. Setup Cron Jobs

Na production serveru:
```bash
# Edit crontab
crontab -e

# Add cron jobs
*/2 * * * * cd /var/www/teltonika60 && /usr/bin/php smart-city-raw-processor.php >> /var/log/smart-city-processor.log 2>&1
0 */2 * * * cd /var/www/teltonika60 && /usr/bin/php smart-city-gps-vehicles-sync-filter.php >> /var/log/smart-city-sync.log 2>&1
```

### 9. Setup TimescaleDB Migrations

```bash
cd /root/smart-city/apps/backend/timescale

# Run migrations
export PATH=$PATH:~/bin
dbmate --migrations-dir ./migrations up
```

### 10. Verify Services

```bash
# Check backend status
pm2 status smart-city-backend
pm2 logs smart-city-backend

# Check database connections
mysql -u smartcity -p -e "SELECT COUNT(*) FROM smartcity.bus_vehicles;"
psql -U smartcity_ts -d smartcity_gps -c "SELECT COUNT(*) FROM gps_data WHERE time > NOW() - INTERVAL '1 hour';"

# Check API endpoints
curl http://localhost:3010/api/health
curl http://localhost:3010/api/vehicles/gps/export -H "x-api-key: gps-sync-key-2025"
```

### 11. Monitor Logs

```bash
# Backend logs
pm2 logs smart-city-backend --lines 100

# GPS processor logs
tail -f /var/log/smart-city-processor.log

# Sync logs
tail -f /var/log/smart-city-sync.log

# Raw GPS log
tail -f /var/www/teltonika60/smart-city-gps-raw-log.txt
```

## 🔍 Verifikacija

### Test GPS Data Flow

1. Proveri da li se kreira raw log:
```bash
tail -f /var/www/teltonika60/smart-city-gps-raw-log.txt
```

2. Proveri MySQL buffer:
```bash
mysql -u smartcity -p -e "SELECT COUNT(*) FROM smartcity.gps_raw_buffer;"
```

3. Proveri TimescaleDB:
```bash
psql -U smartcity_ts -d smartcity_gps -c "SELECT COUNT(*) FROM gps_data WHERE time > NOW() - INTERVAL '10 minutes';"
```

### Expected Results

- ✅ Raw log se puni sa novim GPS podacima
- ✅ MySQL buffer prima filtrirane podatke (978 vozila)
- ✅ TimescaleDB prima procesuirane podatke
- ✅ API endpoints vraćaju podatke

## 🐛 Troubleshooting

### Problem: Nema podataka u raw log
```bash
# Proveri da li util_teltonika.php piše u log
grep "file_put_contents" /var/www/teltonika60/util_teltonika.php
```

### Problem: Processor ne radi
```bash
# Proveri PHP grešku
php /var/www/teltonika60/smart-city-raw-processor.php
```

### Problem: API ne prima podatke
```bash
# Proveri backend logs
pm2 logs smart-city-backend --err
```

### Problem: Vehicle filter je prazan
```bash
# Manually sync vehicles
php /var/www/teltonika60/smart-city-gps-vehicles-sync-filter.php
cat /var/www/teltonika60/smart-city-gps-vehicles.json | jq length
```

## 📊 Monitoring Dashboard

Nakon uspešnog deployment-a, GPS podaci će biti vidljivi na:
- Admin Portal: http://157.230.119.11:3011/gps/tracking
- API Health: http://157.230.119.11:3010/api/health

## 🔄 Rollback Procedure

Ako nešto pođe po zlu:

```bash
# Stop services
pm2 stop smart-city-backend

# Rollback code
cd /root/smart-city
git reset --hard HEAD^
git push origin main --force

# Rollback database
cd apps/backend/timescale
dbmate --migrations-dir ./migrations rollback

# Restart services
pm2 start smart-city-backend
```

## 📝 Post-Deployment Notes

1. **Vehicle Count**: Očekuje se 978 vozila od 2000 (44% acceptance rate)
2. **Batch Size**: 200 GPS points per batch
3. **Cron Interval**: Every 2 minutes
4. **Data Retention**: 90 days in TimescaleDB

## ✅ Deployment Completion Checklist

- [ ] Backend je pokrenut sa PM2
- [ ] Cron jobs su aktivni
- [ ] GPS data flow je verifikovan
- [ ] Logs se pravilno generišu
- [ ] API endpoints rade
- [ ] Vehicle filter ima 978 vozila
- [ ] TimescaleDB prima podatke