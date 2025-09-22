# GitHub Actions Workflows

## 🔍 Prisma Validation

### `validate-prisma.yml`
Automatski validira Prisma schema i migracije kada se promene Prisma fajlovi.

**Trigger:**
- Push na bilo koju granu sa promenama u `apps/backend/prisma/`
- Pull request sa promenama u Prisma fajlovima
- Ručno pokretanje kroz GitHub Actions UI

**Šta radi:**
1. Kreira praznu MySQL test bazu
2. Primenjuje sve migracije
3. Pokreće `validate-prisma-schema.ts` skriptu
4. Upload-uje validation report ako validacija ne prođe

### `validate-prisma-check.yml`
Reusable workflow koji se poziva iz drugih workflow-a.

**Koristi se u:** `deploy-backend.yml`

**Output:**
- `validation-required`: Da li su detektovane promene u Prisma fajlovima
- `validation-passed`: Da li je validacija prošla uspešno

## 🚀 Backend Deployment

### `deploy-backend.yml`
Automatski deploy backend-a na produkciju sa Prisma validacijom.

**Trigger:**
- Push na `main` granu sa promenama u `apps/backend/`
- Ručno pokretanje kroz GitHub Actions UI

**Proces:**
1. **Validate job:**
   - Validira migracije na praznoj test bazi
   - Konektuje se SSH na produkciju
   - Proverava migration status na produkcijskoj bazi
   - Prekida deployment ako ima pending migracija ili drift

2. **Deploy job** (pokreće se samo ako validacija prođe):
   - Pull najnovijih promena na serveru
   - Instalira dependencies
   - Generiše Prisma client
   - Primenjuje migracije
   - Restartuje PM2 servis
   - Verifikuje deployment preko health check-a

## 🔐 GitHub Secrets

Za rad ovih workflow-a potrebni su sledeći secrets u GitHub repository settings:

```yaml
PRODUCTION_SSH_KEY    # SSH private key za pristup produkcijskom serveru
PRODUCTION_HOST       # IP adresa ili hostname produkcijskog servera
PRODUCTION_USER       # SSH username za produkcijski server
```

## 📋 Lokalna validacija

Pre push-a, automatski se pokreće git hook koji validira Prisma setup:

```bash
# Preskoči hook samo za ovaj push (emergency)
git push --no-verify

# Ručno pokreni validaciju
cd apps/backend && npm run prisma:validate
```

## 🛠️ Troubleshooting

### Validacija ne prolazi na GitHub Actions

1. Proverite da li lokalno prolazi:
   ```bash
   cd apps/backend
   npm run prisma:validate
   ```

2. Proverite migration status:
   ```bash
   npx prisma migrate status
   ```

3. Ako ima drift, sinhronizujte:
   ```bash
   npx prisma migrate dev
   ```

### Deploy se prekida zbog validacije

Poruka: "There are pending migrations or schema drift"

**Rešenje:**
1. SSH na produkciju
2. Proverite status:
   ```bash
   cd /home/smartcity/apps/backend
   npx prisma migrate status
   ```
3. Primenite migracije manuelno ako je potrebno:
   ```bash
   npx prisma migrate deploy
   ```

## 📚 Dodatne informacije

- Validacija se pokreće automatski pre svakog deploy-a
- Git hook sprečava push nevalidiranih promena
- Svi validation report-i se čuvaju kao GitHub Artifacts
- Deploy se prekida ako produkcijska baza nije sinhronizovana