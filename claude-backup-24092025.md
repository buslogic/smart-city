# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Smart City platform codebase.

## 🌍 Jezik komunikacije

VAŽNO: Sva komunikacija sa korisnikom treba da bude na srpskom jeziku i latiničnim pismom isključivo.

## 🏙️ Project Overview - Smart City Platform

**Multi-platform** rešenje sa jasnom separacijom korisničkih uloga:

### Aplikacije:
1. 🔧 **Backend API** - jedinstveni API sistem
2. 👨‍💼 **Admin Portal** - web aplikacija za administratore
3. 📊 **Dashboard Portal** - web aplikacija za krajnje korisnike
4. 📱 **Mobile App** - hibridna aplikacija (WebView + Native)


## 🏗️ Tech Stack

### Backend
- **NestJS + TypeScript** - modularna arhitektura
- **Prisma ORM** - type-safe pristup bazi
- **MySQL 8.0** - glavna baza podataka
- **Redis** - keširanje i sesije
- **Socket.io** - real-time komunikacija
- **Bull queues** - background jobs
- **JWT + RBAC** - autentifikacija i autorizacija
- **Swagger** - API dokumentacija

### Admin Portal (Web)
- **React 19 + TypeScript** - najnovija verzija
- **Vite** - build tool
- **Ant Design** - profesionalne admin komponente
- **TanStack Query** - data fetching
- **Zustand** - state management
- **Tailwind CSS** - stilizovanje
- **React Table** - napredne tabele

### Dashboard Portal (Web)
- **React 19 + TypeScript** - isti tech stack
- **Vite** - build tool
- **Material UI / Chakra UI** - moderne UI komponente
- **TanStack Query** - data fetching
- **Zustand** - state management
- **Tailwind CSS** - stilizovanje
- **React DnD** - drag & drop widgets

### Mobile App (Hibridna)
- **Expo SDK 53** - najnoviji Expo
- **React Native 0.79** - sa React 19
- **React Native WebView** - prikaz web sadržaja
- **Expo Router** - file-based routing
- **React Native Paper** - Material Design komponente
- **Native moduli:**
  - **Expo Location** - GPS tracking
  - **Expo Camera** - fotografisanje
  - **Expo Notifications** - push notifikacije
  - **AsyncStorage** - offline storage
- **API klijent** - direktni pozivi backend-a

### Smart City specifične biblioteke

#### Mape i geolokacija

**Web:**
- **Leaflet** - open-source mape
- **Mapbox GL JS** - napredne mape sa 3D podrškom
- **Turf.js** - geo-spatial analiza
- **Leaflet.heat** - heatmape
- **Leaflet.markercluster** - grupisanje markera

**Mobile:**
- **React Native Maps** - native mape (Google/Apple)
- **Expo Location** - GPS i geofencing
- **React Native Background Geolocation** - tracking u pozadini

#### Vizualizacija podataka
- **Chart.js** - osnovni grafikoni
- **Recharts** - React wrapper za D3
- **D3.js** - napredne custom vizualizacije
- **Apache ECharts** - kompleksni interaktivni grafikoni
- **Plotly.js** - 3D grafikoni i scientific plotting

#### IoT i real-time
- **MQTT.js** - MQTT protokol za IoT komunikaciju
- **Socket.io-client** - WebSocket klijent
- **EventSource** - Server-Sent Events
- **node-red** - vizuelno programiranje IoT flow-a (opciono)

#### Monitoring i metriku
- **Prometheus client** - eksportovanje metrika (opciono)
- **MySQL** - čuvanje time-series podataka u optimizovanim tabelama

#### Dodatne utility biblioteke
- **date-fns** - rad sa datumima
- **lodash** - utility funkcije
- **uuid** - generisanje jedinstvenih ID-jeva
- **joi** - validacija podataka
- **winston** - napredni logging

## 🔐 RBAC Sistem

### Predefinisane role
1. **SUPER_ADMIN** - potpun pristup
2. **CITY_MANAGER** - upravljanje gradskim resursima
3. **DEPARTMENT_HEAD** - upravljanje departmanom
4. **OPERATOR** - operativni zadaci
5. **ANALYST** - analitika i izveštaji
6. **CITIZEN** - javni pristup

### Permission struktura
```typescript
{
  resource: string,  // Naziv resursa
  action: 'create' | 'read' | 'update' | 'delete' | 'manage'
}
```

## 📁 Monorepo struktura

```
smart-city/
├── apps/
│   ├── backend/             # NestJS API
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/      # Autentifikacija
│   │   │   │   ├── users/     # User management
│   │   │   │   ├── rbac/      # Role & permissions
│   │   │   │   └── ...        # Ostali moduli
│   │   │   └── main.ts
│   │   └── prisma/
│   ├── admin-portal/       # Admin web app
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   └── services/
│   │   └── vite.config.ts
│   ├── dashboard-portal/   # User web app
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   └── services/
│   │   └── vite.config.ts
│   └── mobile/             # Hybrid mobile app
│       ├── app/
│       │   ├── (tabs)/
│       │   ├── (auth)/
│       │   └── webview/
│       ├── components/
│       │   ├── native/
│       │   └── webview/
│       └── app.json
├── packages/               # Shared kod
│   ├── shared/
│   │   ├── types/
│   │   └── utils/
│   └── ui-kit/
├── docker/
└── package.json           # Workspace config
```

## 🚀 Development Environment

### Portovi
- Backend API: **3010**
- Admin Portal: **3011**
- Dashboard Portal: **3012**
- Mobile Metro: **8081**
- MySQL: **3325**
- Redis: **6380**
- TimescaleDB: **5433**
- MQTT Broker: **1883** (opciono)
- WebSocket: **3010** (isti kao API)

### Pokretanje lokalno

```bash
# Docker servisi
docker-compose -f docker-compose.local.yml up -d

# Sve aplikacije odjednom (iz root foldera)
npm run dev

# Ili pojedinačno:
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Admin Portal
npm run dev:admin

# Terminal 3 - Dashboard Portal
npm run dev:dashboard

# Terminal 4 - Mobile
npm run dev:mobile
```

### Mobile development

```bash
# Expo komande
cd apps/mobile
npx expo start # Pokreće dev server

# Za fizički uređaj
# Skeniraj QR kod sa Expo Go aplikacijom

# Za simulator/emulator
npx expo run:ios
npx expo run:android

# Production build
npx eas build --platform ios
npx eas build --platform android
```

### Prisma komande
```bash
# Generisanje Prisma klijenta
npx prisma generate

# Kreiranje migracije
npx prisma migrate dev --name naziv_migracije

# Deploy migracija na produkciju
npx prisma migrate deploy

# Prisma Studio GUI
npx prisma studio
```

## ⚠️ Važne napomene

### Bash timeout
- **UVEK koristi timeout od 30 sekundi (30000ms) za sve bash komande**
- Default timeout od 2 minuta je predugačak

### Best practices
1. **TypeScript** - striktno tipovanje, bez any tipova
2. **Error handling** - try/catch blokovi, custom error klase
3. **Validation** - class-validator za DTO, Zod za frontend
4. **Testing** - unit testovi za servise, e2e za API
5. **Security** - helmet, rate limiting, input sanitization
6. **Logging** - Winston za strukturirane logove
7. **Database** - koristiti transakcije za complex operacije
8. **API** - RESTful konvencije, verzionisanje
9. **Real-time** - WebSocket za live updates, MQTT za IoT

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

### Environment varijable

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

# Dashboard Portal (.env)
VITE_API_URL=http://localhost:3010
VITE_WS_URL=ws://localhost:3010
VITE_MAPBOX_TOKEN=your-mapbox-token

# Mobile App (.env)
EXPO_PUBLIC_API_URL=http://192.168.1.100:3010
EXPO_PUBLIC_WS_URL=ws://192.168.1.100:3010
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-key
# Napomena: Koristi IP adresu računara, ne localhost!
```

## 🚀 Production Deployment

### Deployment strategija

1. **Backend (DigitalOcean)**
   - Hosted na: `api.smart-city.rs`
   - Platform: DigitalOcean App Platform ili Droplet
   - Database: Managed MySQL
   - Redis: Managed Redis
   - SSL: Let's Encrypt

2. **Web Portali (Vercel)**
   - Admin Portal: `admin.smart-city.rs`
   - Dashboard Portal: `app.smart-city.rs`
   - Auto-deploy iz GitHub
   - Edge functions za optimizaciju

3. **Mobile App (Expo EAS)**
   - Build: EAS Build
   - Distribution: App Store & Google Play
   - Updates: OTA preko Expo Updates

### Deployment komande

```bash
# Backend deploy (DigitalOcean)
git push origin main # Triggers GitHub Action

# Web portali (Vercel)
vercel --prod # Ili automatski preko GitHub

# Mobile app
eas build --platform all
eas submit --platform all
```

## 📊 Monitoring i Logging

### Logging levels
- **error** - greške koje zahtevaju hitnu pažnju
- **warn** - upozorenja o potencijalnim problemima
- **info** - važni eventi (login, transakcije)
- **debug** - detaljan debugging info

### Metrike za praćenje
- API response time
- Database query performance
- WebSocket konekcije
- MQTT message throughput
- Memory i CPU usage
- Error rate

## 🔧 Debugging

### Prisma debugging
```bash
# Prikaži SQL query-je
DEBUG="prisma:query" npm run start:dev

# Detaljan Prisma log
DEBUG="*" npm run start:dev
```

### Node.js debugging
```bash
# Start sa debugger
npm run start:debug

# Attach debugger na port 9229
```

## 📝 Code style

- Koristiti Prettier za formatiranje
- ESLint za linting
- Husky za pre-commit hooks
- Conventional commits za commit poruke
- JSDoc komentare za funkcije
- README.md za svaki modul

## 🎯 Performance optimizacije

1. **Database**
   - Indeksi na često korišćenim kolonama
   - Query optimization sa Prisma
   - Connection pooling

2. **Caching**
   - Redis za session storage
   - Cache API responses
   - CDN za statičke resurse

3. **Frontend**
   - Code splitting
   - Lazy loading
   - React.memo za expensive komponente
   - Virtual scrolling za velike liste

4. **Real-time**
   - WebSocket connection pooling
   - MQTT QoS levels
   - Message batching

## 🚨 Sigurnosne mere

1. **Autentifikacija**
   - JWT sa kratkim expiration
   - Refresh token rotation
   - Multi-factor authentication (opciono)

2. **Autorizacija**
   - RBAC sa granularnim permisijama
   - Resource-based access control
   - API rate limiting

3. **Data protection**
   - HTTPS everywhere
   - Encryption at rest
   - Input validation i sanitization
   - SQL injection prevencija (Prisma)
   - XSS zaštita

## 📚 Dodatni resursi

- [NestJS dokumentacija](https://docs.nestjs.com)
- [Prisma dokumentacija](https://www.prisma.io/docs)
- [React 19 dokumentacija](https://react.dev)
- [Leaflet dokumentacija](https://leafletjs.com)
- [MQTT.js dokumentacija](https://github.com/mqttjs/MQTT.js)
- [Socket.io dokumentacija](https://socket.io/docs)

## 📱 Mobile-specific napomene

### iOS development
- Potreban Xcode 15+ za iOS development
- Apple Developer account za App Store
- Testiranje na fizičkom uređaju preporučeno

### Android development  
- Android Studio za emulator
- Minimum SDK 21 (Android 5.0)
- Google Play Console za publikovanje

### Cross-platform consideracije
- Koristiti platform-specific kod samo kad je neophodno
- Testirati na oba OS-a pre release
- Optimizovati performanse za slabije uređaje
- Offline-first pristup za mobile

## 🗺️ GPS Tracking System (TimescaleDB + PostGIS)

### Implementacija (31.08.2025)
- **TimescaleDB sa PostGIS 3.5** za GPS time-series podatke
- **GPS Ingest API** (`/gps-ingest/batch`) za prijem podataka sa legacy servera
- **Automatska kalkulacija kilometraže** pomoću PostGIS funkcija
- **CRON skriptovi** (PHP/Python) za sinhronizaciju sa legacy serverom
- **API key autentifikacija** za sigurnost

### GPS tabele u TimescaleDB
- `gps_data` - hypertable sa automatskom particijom po danima
- `api_keys` - za autentifikaciju legacy servera
- Unique constraint na (garage_no, time)
- Kompresija nakon 7 dana, retention 90 dana

### Testni podaci
- Importovano 604 GPS tačaka za vozilo P93597
- PostGIS uspešno računa kilometražu i rute