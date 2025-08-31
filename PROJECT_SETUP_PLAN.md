# 🏙️ Smart City Platform - Plan postavljanja projekta

## 📋 Pregled projekta
Smart City platforma sa jasnom separacijom između administrativnog i korisničkog dela:

### Aplikacije:
1. **Backend API** - jedinstveni API sistem za sve klijente
2. **Admin Portal** (web) - administracija sistema, upravljanje korisnicima i resursima
3. **Dashboard Portal** (web) - portal za krajnje korisnike sa vizualizacijama i interakcijama
4. **Mobile App** - hibridna aplikacija za krajnje korisnike
   - WebView komponente za prikaz web sadržaja
   - Native komponente sa direktnim API pozivima
   - Slična funkcionalnost kao Dashboard, ali prilagođena mobilnim uređajima

## 🏗️ Tech Stack

### 📱 Arhitektura rešenja
- **Monorepo struktura** - jedan repository za sve aplikacije
- **Shared kod** - deljene TypeScript definicije i utility funkcije
- **Unified API** - isti backend za web i mobile
- **Real-time sync** - WebSocket za sinhronizaciju između platformi

### Backend (deljeni za web i mobile)
- **NestJS + TypeScript** - modularna arhitektura
- **Prisma ORM** - type-safe pristup bazi podataka
- **MySQL 8.0** - glavna baza podataka
- **Redis** - keširanje i sesije
- **Socket.io** - real-time komunikacija (važno za IoT i monitoring)
- **Bull queues** - procesiranje pozadinskih zadataka
- **JWT** - autentifikacija
- **Swagger** - API dokumentacija

### Admin Portal (Web)
- **React 19 + TypeScript** - najnovija verzija
- **Vite** - build tool
- **Ant Design** - profesionalne admin UI komponente
- **TanStack Query** - data fetching
- **Zustand** - state management
- **Tailwind CSS** - stilizovanje
- **React Table** - napredne tabele sa filterima i sortiranjem

### Dashboard Portal (Web)
- **React 19 + TypeScript** - isti stack kao admin
- **Vite** - build tool  
- **Material UI** ili **Chakra UI** - moderniji UI za krajnje korisnike
- **TanStack Query** - data fetching
- **Zustand** - state management
- **Tailwind CSS** - stilizovanje
- **React DnD** - drag & drop za dashboard customization

### Mobile App (Hibridna - iOS & Android)
- **Expo SDK 53** - React Native framework
- **React Native 0.79** - sa React 19
- **React Native WebView** - za prikaz web sadržaja
- **Expo Router** - file-based routing
- **React Native Paper** - Material Design komponente
- **Native funkcionalnosti:**
  - **Expo Location** - GPS tracking
  - **Expo Notifications** - push notifikacije
  - **Expo Camera** - fotografisanje i QR skeniranje
  - **Expo Sensors** - pristup senzorima uređaja
  - **AsyncStorage** - lokalno čuvanje podataka
- **API integracija** - direktni pozivi backend API-ja

### Smart City specifične biblioteke

#### Web biblioteke
- **Leaflet/Mapbox GL JS** - interaktivne mape za web
- **Chart.js/Recharts** - vizualizacija podataka
- **D3.js** - napredne vizualizacije
- **Socket.io-client** - real-time updates
- **Turf.js** - geo-spatial analiza

#### Mobile biblioteke  
- **React Native Maps** - mape za mobile (Google Maps/Apple Maps)
- **React Native Charts** - grafikoni optimizovani za mobile
- **React Native MQTT** - IoT komunikacija na mobile
- **React Native Background Geolocation** - tracking u pozadini
- **React Native Sensors** - pristup senzorima uređaja

### DevOps i Deployment
- **Docker** - kontejnerizacija (backend)
- **Docker Compose** - lokalni development
- **GitHub Actions** - CI/CD pipeline
- **Deployment platforme:**
  - **DigitalOcean** - Backend API (Droplet ili App Platform)
  - **Vercel** - Admin Portal i Dashboard Portal
  - **Expo EAS** - Mobile app build i distribucija
- **Nginx** - reverse proxy na DigitalOcean

### Sigurnost i kontrola pristupa
- **RBAC sistem** - Role-Based Access Control
- **JWT sa refresh tokenima** - sigurna autentifikacija
- **Permission-based middleware** - granularna kontrola pristupa
- **Rate limiting** - zaštita od abuse
- **Helmet.js** - security headers

## 📁 Struktura projekta (Monorepo)

```
smart-city/
├── apps/
│   ├── backend/             # NestJS API sistem
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── rbac/
│   │   │   │   └── ...      # Dodatni moduli po potrebi
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   └── package.json
│   ├── admin-portal/       # Admin web aplikacija
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   │   ├── users/
│   │   │   │   ├── settings/
│   │   │   │   ├── resources/
│   │   │   │   └── monitoring/
│   │   │   ├── services/
│   │   │   └── stores/
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── dashboard-portal/   # Korisnički web portal
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   │   ├── home/
│   │   │   │   ├── maps/
│   │   │   │   ├── reports/
│   │   │   │   └── services/
│   │   │   ├── services/
│   │   │   └── stores/
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── mobile/             # Hibridna mobilna app
│       ├── app/            # Expo Router
│       │   ├── (tabs)/     
│       │   ├── (auth)/     
│       │   ├── webview/    # WebView screens
│       │   └── _layout.tsx
│       ├── components/
│       │   ├── native/     # Native komponente
│       │   └── webview/    # WebView wrapper komponente
│       ├── services/       # API pozivi
│       ├── package.json
│       └── app.json
├── packages/               # Deljeni kod
│   ├── shared/            
│   │   ├── types/         # TypeScript definicije
│   │   ├── utils/
│   │   └── constants/
│   └── ui-kit/            # Opciono: deljene UI komponente
├── docker/
├── docker-compose.yml
├── package.json           # Root workspace config
├── CLAUDE.md
└── README.md
```

## 🚀 Koraci implementacije

### Faza 1: Osnovna infrastruktura
1. **Monorepo setup**
   - [ ] Inicijalizacija npm workspaces
   - [ ] Kreiranje folder strukture
   - [ ] Git repository setup
   - [ ] Dodavanje .gitignore fajlova
   - [ ] Konfiguracija TypeScript paths

2. **Backend setup**
   - [ ] NestJS instalacija i konfiguracija
   - [ ] Prisma setup sa MySQL
   - [ ] Docker compose za lokalni development
   - [ ] Environment varijable (.env files)
   - [ ] CORS i security middleware

3. **Web Frontend setup**
   - [ ] React 19 sa Vite
   - [ ] TypeScript konfiguracija
   - [ ] Tailwind CSS i Ant Design
   - [ ] Routing setup (React Router)
   - [ ] API client konfiguracija (Axios)

4. **Mobile App setup**
   - [ ] Expo SDK 53 inicijalizacija
   - [ ] Expo Router konfiguracija
   - [ ] React Native Paper/NativeBase setup
   - [ ] Konfiguracija za iOS i Android
   - [ ] Push notifikacije setup

### Faza 2: Autentifikacija i RBAC
1. **Auth modul**
   - [ ] JWT implementacija
   - [ ] Refresh token logika
   - [ ] Login/Logout endpoints
   - [ ] Password reset flow

2. **RBAC sistem**
   - [ ] Prisma modeli za Role, Permission, UserRole
   - [ ] Guards za permission checking
   - [ ] Decorators za route protection
   - [ ] Frontend permission utilities

3. **User management**
   - [ ] CRUD operacije za korisnike
   - [ ] Role assignment
   - [ ] User profile management

### Faza 3: Core funkcionalnosti
1. **Osnovni moduli**
   - [ ] Implementacija po potrebi
   - [ ] Integracija sa API-jem
   - [ ] Testing

### Faza 4: Dodatne funkcionalnosti
1. **Proširenja sistema**
   - [ ] Dodavanje novih modula po potrebi
   - [ ] Integracije sa eksternim servisima
   - [ ] Optimizacija performansi

### Faza 5: Production setup
1. **Backend deployment (DigitalOcean)**
   - [ ] Droplet setup sa Docker
   - [ ] MySQL managed database
   - [ ] Redis setup
   - [ ] Nginx konfiguracija
   - [ ] SSL sertifikati
   - [ ] GitHub Actions za auto-deploy

2. **Web portali deployment (Vercel)**
   - [ ] Admin Portal setup na Vercel
   - [ ] Dashboard Portal setup na Vercel
   - [ ] Environment varijable
   - [ ] Custom domeni
   - [ ] GitHub integracija za auto-deploy

3. **Mobile deployment (Expo EAS)**
   - [ ] EAS Build konfiguracija
   - [ ] App Store i Google Play setup
   - [ ] Over-the-air (OTA) updates
   - [ ] Push notification setup

4. **Monitoring**
   - [ ] Sentry za error tracking
   - [ ] Analytics (Google/Mixpanel)
   - [ ] Uptime monitoring
   - [ ] Log management

## 🔧 Development komande

```bash
# Inicijalizacija monorepo
npm init -y
npm install -D lerna nx

# Instalacija dependencies (iz root foldera)
npm install # instalira sve workspace dependencies

# Pokretanje Docker servisa
docker-compose -f docker-compose.local.yml up -d

# Prisma migracije
cd apps/backend
npx prisma generate
npx prisma migrate dev

# Pokretanje development servera
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Web
npm run dev:web

# Terminal 3 - Mobile
npm run dev:mobile

# Ili sve odjednom
npm run dev:all

# Mobile specific komande
cd apps/mobile
npx expo start # Pokreće Expo dev server
npx expo run:ios # iOS simulator
npx expo run:android # Android emulator
npx eas build # Production build

# Testiranje
npm run test:backend
npm run test:web
npm run test:mobile

# Build za produkciju
npm run build:all
```

## 📝 Environment varijable

### Backend (.env)
```env
# Database
DATABASE_URL="mysql://user:password@localhost:3325/smartcity"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=RedisPassword123!

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# API
PORT=3010
NODE_ENV=development

# MQTT (za IoT)
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=

# Maps
MAPBOX_ACCESS_TOKEN=your-mapbox-token
```

### Admin Portal (.env.local)
```env
# Development
VITE_API_URL=http://localhost:3010
VITE_WS_URL=ws://localhost:3010
VITE_PORT=3011

# Production (Vercel)
VITE_API_URL=https://api.smart-city.rs
VITE_WS_URL=wss://api.smart-city.rs
VITE_MAPBOX_TOKEN=your-mapbox-token
```

### Dashboard Portal (.env.local)
```env
# Development
VITE_API_URL=http://localhost:3010
VITE_WS_URL=ws://localhost:3010
VITE_PORT=3012

# Production (Vercel)
VITE_API_URL=https://api.smart-city.rs
VITE_WS_URL=wss://api.smart-city.rs
VITE_MAPBOX_TOKEN=your-mapbox-token
```

### Mobile App (.env)
```env
# Development
EXPO_PUBLIC_API_URL=http://192.168.1.100:3010
EXPO_PUBLIC_WS_URL=ws://192.168.1.100:3010

# Production
EXPO_PUBLIC_API_URL=https://api.smart-city.rs
EXPO_PUBLIC_WS_URL=wss://api.smart-city.rs
EXPO_PUBLIC_MAPBOX_TOKEN=your-mapbox-token
```

## 🔐 RBAC Model

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String
  firstName String
  lastName  String
  isActive  Boolean  @default(true)
  roles     UserRole[]
  // ... ostala polja
}

model Role {
  id          Int              @id @default(autoincrement())
  name        String           @unique
  description String?
  permissions RolePermission[]
  users       UserRole[]
}

model Permission {
  id          Int              @id @default(autoincrement())
  name        String           @unique
  resource    String
  action      String
  description String?
  roles       RolePermission[]
}

model UserRole {
  userId Int
  roleId Int
  user   User @relation(fields: [userId], references: [id])
  role   Role @relation(fields: [roleId], references: [id])
  
  @@id([userId, roleId])
}

model RolePermission {
  roleId       Int
  permissionId Int
  role         Role       @relation(fields: [roleId], references: [id])
  permission   Permission @relation(fields: [permissionId], references: [id])
  
  @@id([roleId, permissionId])
}
```

## 📊 Predefinisane role

1. **Super Admin** - potpun pristup sistemu
2. **City Manager** - upravljanje gradskim resursima
3. **Department Head** - upravljanje specifičnim departmanom
4. **Operator** - operativni zadaci
5. **Analyst** - pristup analitici i izveštajima
6. **Citizen** - javni pristup sa ograničenjima

## 🚀 Deployment konfiguracija

### Vercel setup (za web portale)

**vercel.json** za Admin Portal:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

**vercel.json** za Dashboard Portal:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

### Expo EAS konfiguracija

**eas.json** za Mobile app:
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id",
        "ascAppId": "your-app-store-connect-id",
        "appleTeamId": "your-team-id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      }
    }
  }
}
```

### GitHub Actions workflow

**.github/workflows/deploy.yml**:
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to DigitalOcean
        run: |
          # SSH deploy script
          
  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Vercel
        run: |
          # Vercel automatski deployuje preko GitHub integracije
```

## ⚠️ Napomene

- Koristiti TypeScript striktno za type safety
- Implementirati error handling na svim nivoima
- Pisati unit i integration testove
- Dokumentovati API endpoints sa Swagger
- Koristiti environment varijable za sve konfiguracije
- Implementirati rate limiting za API
- Dodati request/response logging
- Koristiti database transactions gde je potrebno
- Implementirati data validation na backend i frontend
- Optimizovati database queries sa indeksima

## 🎯 Ciljevi projekta

1. **Skalabilnost** - sistem koji može da podrži rast grada
2. **Modularnost** - lako dodavanje novih funkcionalnosti
3. **Real-time monitoring** - praćenje u realnom vremenu
4. **Integracije** - povezivanje sa postojećim sistemima
5. **User-friendly** - intuitivan interfejs
6. **Sigurnost** - robusna autentifikacija i autorizacija
7. **Performance** - brz odziv i efikasno korišćenje resursa

## 🔑 Razlike između aplikacija

### Admin Portal
- **Korisnici**: Administratori sistema
- **Fokus**: Upravljanje i administracija

### Dashboard Portal  
- **Korisnici**: Krajnji korisnici
- **Fokus**: Pregled i interakcija sa podacima

### Mobile App
- **Korisnici**: Krajnji korisnici u pokretu
- **Fokus**: Hibridna funkcionalnost (WebView + Native)