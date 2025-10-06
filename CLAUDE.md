# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Smart City platform codebase.

## 🌍 Jezik komunikacije

VAŽNO: Sva komunikacija sa korisnikom treba da bude na srpskom jeziku i latiničnim pismom isključivo.

## 📚 OBAVEZNO PROČITAJ PRE POČETKA RADA

Molim te pročitaj sledeće fajlove pre početka rada:
1. **claude-tips.md** - Važni saveti za efikasan rad i česte greške
2. **claude-personal.md** - Privatni podaci i kredencijali (NE COMMITUJ!)
3. **claude-electron-api.md** - SADMIN Developer Agent integracija i task management
4. **claude-mcp-servers.md** - MCP serveri za automatizovano testiranje (ako radiš testiranje)

## 🎯 Suština projekta

Smart City platforma za upravljanje gradskom infrastrukturom sa fokusom na transport, GPS praćenje vozila i analitiku. Sistem omogućava real-time monitoring vozila, analizu vožnje, dispečerske operacije i naprednu analitiku gradskog transporta.

## 🏗️ Arhitektura sistema

### Tech Stack
- **Backend**: NestJS 11, TypeScript 5.7, Prisma ORM 6.13
- **Frontend**: React 19, Vite 7, Ant Design 5.27
- **Baze podataka**: MySQL 8 (glavni), TimescaleDB/PostGIS (GPS), Redis (cache)
- **Real-time**: Socket.io, WebSocket
- **Deployment**: DigitalOcean (API), Vercel (Web)

### Aplikacije u monorepo strukturi
```
/apps
├── backend/        # REST API + WebSocket server
└── admin-portal/   # Admin UI za upravljanje
```

## 🔧 Admin Portal - Runtime Configuration

**VAŽNO:** Admin portal koristi **runtime config sistem** za Kubernetes deploymente!

### Fallback Chain (prioritet)
1. **window.APP_CONFIG** (Kubernetes ConfigMap) - runtime injection
2. **import.meta.env.VITE_*** (Vercel/local .env) - build-time
3. **Hardcoded fallback** (localhost:3010) - default

### Ključni fajlovi
- **`src/config/runtime.ts`** - Runtime config helper sa fallback-om
- **`public/config.js`** - Fallback za development/Vercel
- **`index.html`** - Učitava config.js PRE React aplikacije

### Deployment strategije
- **Vercel**: Koristi build-time env varijable (`VITE_API_URL`)
- **Kubernetes**: ConfigMap override-uje `/config.js` sa runtime podešavanjima
- **Local Dev**: Koristi `.env` fajl ili fallback

### Kako koristiti
```typescript
// ✅ ISPRAVNO - uvek koristi runtime helper
import { API_URL, WS_URL } from '../config/runtime';

// ❌ POGREŠNO - NE koristi direktno import.meta.env
const url = import.meta.env.VITE_API_URL; // GREŠKA!
```

## 📦 Ključni backend moduli

### Core funkcionalnosti
- **Auth** - JWT autentifikacija, refresh tokeni
- **RBAC** - Role-based access control (Users, Roles, Permissions)
- **Users** - Upravljanje korisnicima, avatar upload

### GPS & Transport
- **Vehicles** - Upravljanje vozilima flote
- **GpsIngest** - Prijem GPS podataka sa legacy servera
- **GpsSync** - Sinhronizacija sa legacy MySQL bazom
- **GpsProcessor** - Batch obrada GPS podataka
- **GpsAnalytics** - Analitika ruta i kilometraže
- **DrivingBehavior** - Analiza agresivne vožnje
- **DrivingRecreation** - Rekonstrukcija vožnje

### Podrška
- **Dispatcher** - Dispečerski modul sa real-time statusima
- **Dashboard** - Konfiguracija korisničkih dashboard-a
- **Mail/EmailTemplates** - Email notifikacije
- **ApiKeys** - API key autentifikacija za eksterne servise
- **Spaces** - S3-kompatibilno skladište (DigitalOcean Spaces)

### Integracije
- **LegacyDatabases** - Konekcije na postojeće MySQL baze
- **VehicleSync** - Sinhronizacija vozila iz legacy sistema
- **TimescaleDB** - Time-series GPS podaci sa PostGIS
- **Migration** - Migracija podataka između sistema

## ⚠️ KRITIČNA NAPOMENA: Vehicle identifikatori i VehicleMapper

### Problem sa ID-evima
Sistem koristi TRI različita identifikatora za vozila:

1. **`id`** - PRIMARNI KLJUČ u našoj MySQL bazi (`bus_vehicles`) - NEPROMENLJIV
2. **`legacy_id`** - ID iz legacy sistema (unique u `bus_vehicles`) - samo za legacy integraciju
3. **`garage_number`** - garažni broj vozila (unique, npr. "P93597") - MOŽE SE PROMENITI

### 🔴 OBAVEZNO KORISTI VEHICLEMAPPER HELPER!

**NIKADA ne radi direktne konverzije između identifikatora!**

#### Lokacije VehicleMapper helper-a:
- **Frontend:** `/apps/admin-portal/src/utils/vehicle-mapper.ts`
- **Backend:** `/apps/backend/src/common/helpers/vehicle-mapper.ts`

#### Pravilno korišćenje:
```typescript
// ✅ ISPRAVNO - koristi VehicleMapper
import { VehicleMapper } from '@/utils/vehicle-mapper';

const garageNo = await VehicleMapper.idToGarageNumber(460); // "P93597"
const vehicleId = await VehicleMapper.garageNumberToId("P93597"); // 460

// ❌ POGREŠNO - direktna konverzija
const vehicle = vehicles.find(v => v.garageNumber === "P93597");
const id = vehicle.id; // NE RADI OVO!
```

## 🔴 KRITIČNO: TimescaleDB migracije

### ⚠️ OBAVEZNO PRAVILO:
**NIKADA ne izvršavaj SQL komande direktno na TimescaleDB bazi!**
Sve promene MORAJU proći kroz dbmate migracije zbog LIVE servera.

### 🤖 Automatsko izvršavanje migracija (GitHub Actions)

**VAŽNO:** Migracije se automatski izvršavaju preko GitHub Actions workflow-a!

**Workflow:** `.github/workflows/timescale-migrations.yml`

**Automatski trigger:**
- Push na `main` branch SA promenama u `apps/backend/timescale/migrations/**`
- Workflow automatski: instalira dbmate → proverava status → izvršava `dbmate up`

**Ručno pokretanje:**
```bash
# Preko GitHub CLI:
gh workflow run timescale-migrations.yml

# Ili preko GitHub UI:
# Actions → TimescaleDB Migrations → Run workflow
```

**Praćenje statusa:**
```bash
gh run list --workflow=timescale-migrations.yml --limit 5
gh run view [RUN_ID] --log
```

### 💻 Lokalni development (dbmate komande)

```bash
# UVEK prelazi u ovaj direktorijum pre rada sa migracijama:
cd /home/kocev/smart-city/apps/backend/timescale

# Proveri status migracija:
export PATH=$PATH:~/bin && dbmate --migrations-dir ./migrations status

# Pokreni sve migracije (LOKALNO):
export PATH=$PATH:~/bin && dbmate --migrations-dir ./migrations up

# Kreiraj novu migraciju:
export PATH=$PATH:~/bin && dbmate --migrations-dir ./migrations new naziv_migracije
```

**Napomena:** Za LIVE server, NE pokreći migracije ručno - pusti GitHub Actions!

## 🚀 Development workflow

### Lokalni development
```bash
# Pokreni Docker servise
docker-compose -f docker-compose.local.yml up -d

# Pokreni aplikacije
npm run dev           # Backend + Admin portal
npm run dev:backend   # Samo backend
npm run dev:admin     # Samo admin portal

# Prisma komande
npx prisma migrate dev
npx prisma studio
npx prisma generate
```

### Portovi
- Backend API: **3010**
- Admin Portal: **3011**
- MySQL: **3325**
- Redis: **6380**
- TimescaleDB: **5433**

### ⚠️ Bash timeout
**UVEK koristi timeout od 30 sekundi (30000ms) za sve bash komande**
Default timeout od 2 minuta je predugačak.

## 🔑 Važni koncepti

### RBAC sistem
- 6 predefinisanih rola (SUPER_ADMIN do CITIZEN)
- Granularne permisije po resursima
- Guards na svim API endpointima

### GPS podaci
- TimescaleDB hypertable sa automatskom particijom
- PostGIS za geo-spatial kalkulacije
- Unique constraint na (vehicle_id, time)
- Kompresija posle 7 dana, retention 90 dana

## 🔐 Sigurnost

- JWT sa kratkim expiration (15min access, 7d refresh)
- Rate limiting na API endpointima
- Input validacija sa class-validator
- SQL injection prevencija kroz Prisma
- API key autentifikacija za legacy servere

## 📝 Konvencije koda

### TypeScript
- Strict mode - bez `any` tipova
- Prettier formatiranje
- ESLint pravila
- Error handling sa custom klasama
- DTO validacija na svim endpointima

### Git workflow
```bash
# Feature branch
git checkout -b feature/naziv-feature

# Commit poruke
git commit -m "feat: dodaj novu funkcionalnost"
git commit -m "fix: ispravi bug u modulu"
git commit -m "docs: ažuriraj dokumentaciju"
git commit -m "refactor: refaktorisanje koda"
git commit -m "test: dodaj testove"
```

## 🌍 Environment varijable

```env
# Backend (.env)
DATABASE_URL="mysql://user:password@localhost:3325/smartcity"
REDIS_URL="redis://:password@localhost:6380"
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"
PORT=3010

# Admin Portal (.env)
VITE_API_URL=http://localhost:3010
VITE_WS_URL=ws://localhost:3010
VITE_MAPBOX_TOKEN=your-mapbox-token

# Mobile App (.env)
EXPO_PUBLIC_API_URL=http://192.168.1.100:3010
EXPO_PUBLIC_WS_URL=ws://192.168.1.100:3010
# Napomena: Koristi IP adresu računara, ne localhost!
```

## 📊 Monitoring i debugging

### Logging
- Winston logger sa strukturiranim logovima
- Nivoi: error, warn, info, debug

### Prisma debugging
```bash
DEBUG="prisma:query" npm run start:dev
```

### Node.js debugging
```bash
npm run start:debug
# Attach debugger na port 9229
```

## 📁 Monorepo struktura

```
smart-city/
├── apps/
│   ├── backend/             # NestJS API
│   │   ├── src/
│   │   │   ├── auth/        # Autentifikacija
│   │   │   ├── users/       # User management
│   │   │   ├── roles/       # Role management
│   │   │   ├── permissions/ # Permission management
│   │   │   ├── vehicles/    # Vehicle management
│   │   │   ├── gps-*/       # GPS moduli
│   │   │   ├── driving-*/   # Driving analiza
│   │   │   └── ...
│   │   ├── prisma/          # Prisma shema i migracije
│   │   └── timescale/       # TimescaleDB migracije
│   └── admin-portal/        # Admin web app
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── services/
│       │   └── utils/
│       └── vite.config.ts
├── packages/                # Shared kod (za buduće)
├── docker/
├── docker-compose.local.yml
└── package.json            # Root workspace config
```

## 🎯 Trenutni fokus

Projekat je u aktivnom razvoju sa fokusom na:
1. GPS tracking i analitiku vozila
2. Dispečerske operacije
3. Integracija sa legacy sistemima
4. Real-time monitoring
5. Napredna analitika vožnje

## 🤝 Integracija sa SADMIN Developer Agent

Projekat je integrisan sa SADMIN Developer Agent aplikacijom koja omogućava:
- Automatsko praćenje rada na taskovima
- Screenshot funkcionalnost tokom rada
- Integraciju sa projektima i dokumentacijom

### Važni ID-jevi
- **Smart-City 2025 projekt ID**: `a7940d6e-2429-46a7-b9dc-c1a3800ad9f8`

Za detalje o korišćenju Developer Agent-a pogledajte `claude-electron-api.md`.

## 🧪 MCP Server za automatizovano testiranje

MCP (Model Context Protocol) serveri omogućavaju napredne funkcionalnosti za automatizovano testiranje i kontrolu browser-a.

Za detalje o korišćenju Chrome DevTools MCP servera pogledajte **claude-mcp-servers.md**.

## 📚 Povezani fajlovi

### Konfiguracija i pomoć
- **claude-tips.md** - Praktični saveti za rad, česte greške, database pristup
- **claude-personal.md** - Privatni kredencijali i SSH pristup (NIKAD ne commituj!)
- **claude-electron-api.md** - SADMIN Developer Agent integracija

### Dodatna dokumentacija
- **claude-mcp-servers.md** - MCP serveri i automatizovano testiranje
- **claude-shortcuts.md** - Keyboard shortcuts za Claude Code
- **claude-hooks.md** - Git hooks konfiguracija
- **claude-new-menu.md** - Procedura za dodavanje novih meni opcija

## ✅ Checklist za development

**Obavezno proveri pre rada:**
- [ ] Pročitaj claude-tips.md za važne savete
- [ ] Pročitaj claude-personal.md za kredencijale
- [ ] Pročitaj claude-electron-api.md za task management
- [ ] Docker servisi su pokrenuti
- [ ] Prisma migracije su primenjene
- [ ] TimescaleDB migracije su primenjene (dbmate)
- [ ] Chrome browser pokrenut (za MCP testiranje)

**Pre svakog commit-a:**
- [ ] TypeScript kompajliranje bez grešaka
- [ ] Prisma validacija prošla (`npm run prisma:validate`)
- [ ] ESLint provera prošla
- [ ] Testovi prolaze (ako postoje)

**Pre push-a na main:**
- [ ] Svi lokalni testovi prolaze
- [ ] Dokumentacija ažurirana
- [ ] Environment varijable proverene
- [ ] Nema hardkodovanih kredencijala