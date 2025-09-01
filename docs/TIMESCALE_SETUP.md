# TimescaleDB Cloud Setup

## 🚀 GitHub Actions Setup

### Potrebni GitHub Secrets

Idite na: **Settings → Secrets and variables → Actions** u vašem GitHub repozitoriju i dodajte:

1. **TIMESCALE_DATABASE_URL** (OBAVEZNO)
   ```
   postgres://tsdbadmin:Buslogic123!@b96osgyp1w.duvl2ceai2.tsdb.cloud.timescale.com:31143/tsdb?sslmode=require
   ```

2. **SLACK_WEBHOOK** (opciono)
   - Za Slack notifikacije o statusu migracija
   - Format: `https://hooks.slack.com/services/xxx/yyy/zzz`

### Kako dodati GitHub Secret:

1. Idite na: https://github.com/[your-username]/smart-city/settings/secrets/actions
2. Kliknite **"New repository secret"**
3. **Name**: `TIMESCALE_DATABASE_URL`
4. **Value**: Kopirajte connection string iznad
5. Kliknite **"Add secret"**

## 📝 Workflow korišćenje

### Automatske migracije
- Svaki push na `main` branch koji menja migracije automatski pokreće workflow
- Migracije se nalaze u: `apps/backend/timescale/migrations/`

### Manuelno pokretanje
1. Idite na **Actions** tab
2. Izaberite **"TimescaleDB Migrations"** workflow
3. Kliknite **"Run workflow"**
4. Izaberite akciju:
   - `up` - pokreni sve pending migracije
   - `status` - samo prikaži status
   - `rollback` - vrati poslednju migraciju

## 🔧 Lokalni development

### Korišćenje produkcijske baze (Timescale Cloud)
```bash
cd apps/backend/timescale
export DATABASE_URL="postgres://tsdbadmin:Buslogic123!@b96osgyp1w.duvl2ceai2.tsdb.cloud.timescale.com:31143/tsdb?sslmode=require"
dbmate --migrations-dir ./migrations status
```

### Korišćenje lokalne baze (Docker)
```bash
# Pokreni lokalni TimescaleDB
docker-compose -f docker-compose.local.yml up -d timescaledb

# Koristi lokalni connection string
export DATABASE_URL="postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps?sslmode=disable"
dbmate --migrations-dir ./migrations status
```

## 🏗️ Struktura migracija

```
apps/backend/timescale/
├── .env                     # Environment varijable
├── dbmate.yml              # dbmate konfiguracija
└── migrations/             # SQL migracije
    ├── 20250901000000_initial_seed.sql
    └── 20250901000001_aggressive_driving_detection.sql
```

## ⚠️ Važne napomene

1. **NIKADA ne komitujte .env fajlove sa pravim kredencijalima!**
2. **Uvek testirajte migracije lokalno pre push-a**
3. **Rollback je moguć samo za poslednju migraciju**
4. **Backup baze se pravi automatski na Timescale Cloud-u**

## 🔐 Sigurnost

### Preporučene akcije:
1. **Rotirajte password** nakon inicijalnog setup-a
2. **Ograničite IP pristup** na Timescale Cloud konzoli
3. **Koristite različite kredencijale** za dev/staging/production
4. **Redovno proveravajte audit logove**

## 📊 Monitoring

Timescale Cloud Dashboard: https://console.cloud.timescale.com/dashboard/services/b96osgyp1w/overview

### Ključne metrike:
- CPU usage
- Memory usage
- Storage usage
- Connection count
- Query performance

## 🆘 Troubleshooting

### Problem: Migracije ne rade
```bash
# Proverite connection string
psql "$DATABASE_URL" -c "SELECT 1"

# Proverite dbmate
dbmate --version

# Debug mode
DEBUG=* dbmate --migrations-dir ./migrations status
```

### Problem: Permission denied
- Proverite da li `tsdbadmin` user ima potrebne privilegije
- Kontaktirajte Timescale Support ako je potrebno

## 📞 Kontakti

- **Timescale Support**: support@timescale.com
- **GitHub Actions dokumentacija**: https://docs.github.com/en/actions
- **dbmate dokumentacija**: https://github.com/amacneil/dbmate