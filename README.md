# Smart City Platform

Multi-platform rešenje za pametne gradove sa React, NestJS i React Native aplikacijama.

## 🚀 Brzi početak

### Preduslov
- Node.js 18+
- Docker i Docker Compose
- npm ili yarn

### Instalacija

1. Kloniraj repozitorijum
```bash
git clone https://github.com/your-repo/smart-city.git
cd smart-city
```

2. Pokreni Docker kontejnere (MySQL i Redis)
```bash
npm run docker:up
```

3. Instaliraj dependencies
```bash
npm run install:all
```

4. Pokreni migracije i seed podatke
```bash
npm run db:migrate
npm run db:seed
```

5. Pokreni aplikacije
```bash
# Pokreni backend i admin portal zajedno
npm run dev

# Ili pojedinačno:
npm run dev:backend  # Backend API (port 3010)
npm run dev:admin    # Admin Portal (port 3011)
```

## 📁 Struktura projekta

```
smart-city/
├── apps/
│   ├── backend/           # NestJS API server
│   ├── admin-portal/      # React Admin aplikacija
│   ├── dashboard-portal/  # React Dashboard (TODO)
│   └── mobile/           # React Native app (TODO)
├── packages/             # Shared packages (TODO)
├── docker-compose.local.yml
└── package.json
```

## 🔧 Dostupne komande

```bash
# Development
npm run dev              # Pokreće backend i admin portal
npm run dev:backend      # Samo backend
npm run dev:admin        # Samo admin portal

# Docker
npm run docker:up        # Pokreće MySQL i Redis
npm run docker:down      # Zaustavlja kontejnere
npm run docker:logs      # Prikazuje logove

# Database
npm run db:migrate       # Pokreće Prisma migracije
npm run db:seed         # Popunjava bazu test podacima
npm run db:studio       # Otvara Prisma Studio GUI
```

## 🌐 Aplikacije i portovi

- **Backend API**: http://localhost:3010
  - Swagger docs: http://localhost:3010/api/docs
- **Admin Portal**: http://localhost:3011
- **MySQL**: localhost:3325
- **Redis**: localhost:6380

## 🔐 Test korisnici

Svi test korisnici imaju lozinku: `Test123!`

| Email | Uloga | Status |
|-------|-------|--------|
| admin@smart-city.rs | SUPER_ADMIN | Aktivan |
| petar.petrovic@smart-city.rs | CITY_MANAGER | Aktivan |
| milica.nikolic@smart-city.rs | OPERATOR | Aktivan |
| stefan.stojanovic@smart-city.rs | ANALYST | Neaktivan |
| ana.anic@smart-city.rs | DEPARTMENT_HEAD | Aktivan |

## 📊 Admin Portal funkcionalnosti

### Trenutno implementirano:
- ✅ Glavni layout sa menijem
- ✅ Administracija korisnika
  - Tabelarni pregled
  - Aktivacija/deaktivacija
  - Brisanje korisnika
  - Mock podaci za testiranje

### U planu:
- 🔄 Login stranica
- 🔄 Kreiranje/editovanje korisnika
- 🔄 Upravljanje ulogama
- 🔄 Dashboard sa statistikama

## 🛠️ Tech Stack

### Backend
- NestJS 11
- Prisma ORM 6
- MySQL 8
- Redis 7
- JWT autentifikacija
- Swagger dokumentacija

### Frontend (Admin Portal)
- React 19
- TypeScript
- Vite
- Ant Design
- React Router
- Axios
- Tailwind CSS

## 📝 Napomene za development

- Backend automatski restartuje na promene (nodemon)
- Frontend ima Hot Module Replacement (HMR)
- Swagger dokumentacija dostupna na `/api/docs`
- Prisma Studio za pregled baze: `npm run db:studio`

## 🐛 Poznati problemi

- CORS je konfigurisan samo za localhost portove
- Autentifikacija još nije implementirana u frontend-u
- Mock podaci se koriste kad backend nije dostupan