# 📊 Dispečerski Modul - Analiza | Plan Implementacije

## 📋 Pregled funkcionalnosti

Modul za detaljnu analizu pojedinačnih vozila sa GPS podacima iz TimescaleDB. Omogućava praćenje performansi, efikasnosti i statistike vozila kroz različite vremenske periode.

## 🎯 Ključne karakteristike

### 1. Selekcija i filtriranje
- **Selektor vozila** - dropdown sa svim vozilima iz `bus_vehicle` tabele
  - Prikaz: `garageNumber - registrationNumber`
  - Pretraga po garage number ili registraciji
  - Auto-selekcija prvog vozila

- **Selektor perioda** - date range picker
  - Preset opcije: Danas, Juče, Poslednja nedelja, Poslednji mesec
  - Custom range selekcija
  - Default: Današnji dan

### 2. KPI Dashboard (Key Performance Indicators)

#### Primarne metrike (velike kartice):
- 🗺️ **Ukupna kilometraža** - PostGIS ST_Length kalkulacija
- 🚗 **Prosečna brzina** - avg(speed) gde je speed > 0
- ⚡ **Maksimalna brzina** - max(speed) sa upozorenjem ako > 80km/h
- ⏱️ **Vreme vožnje** - ukupno sati kada je vozilo bilo u pokretu

#### Sekundarne metrike (male kartice):
- 📍 **GPS tačaka** - broj zabeleženih pozicija
- 🛑 **Broj zaustavljanja** - detekcija kada speed = 0 duže od 2 min
- ⏸️ **Vreme mirovanja** - ukupno vreme kada je speed = 0
- 📊 **Efikasnost** - procenat vremena u pokretu (gauge chart)

### 3. Grafikoni i vizualizacije

#### 3.1 Vremenska analiza
- **Line Chart: Brzina po satima**
  - X-osa: Sati (00-23)
  - Y-osa: Prosečna brzina (km/h)
  - Smooth line sa animacijom

- **Column Chart: Kilometraža po satima**
  - X-osa: Sati (00-23)
  - Y-osa: Pređeni kilometri
  - Zaobljene kolone sa hover efektom

#### 3.2 Distribucija brzine
- **Progress Bars: Raspodela brzine**
  - 0-20 km/h (gradska vožnja)
  - 20-40 km/h (normalna brzina)
  - 40-60 km/h (brža vožnja)
  - 60+ km/h (autoput/magistrala)
  - Prikaz u procentima vremena

#### 3.3 Trend analiza (za periode > 1 dan)
- **Area Chart: Dnevna kilometraža**
  - Prikaz trenda kroz vreme
  - Fill opacity za bolju vizualizaciju

### 4. Tabelarni prikazi

#### 4.1 Dnevna statistika (za duže periode)
| Datum      | Kilometraža | Sati vožnje | Efikasnost |
|------------|-------------|-------------|------------|
| 01.09.2024 | 234.5 km    | 8.2 h       | 78%        |
| 02.09.2024 | 198.3 km    | 7.1 h       | 72%        |

## 🔧 Tehnička implementacija

### Backend struktura

#### 1. Novi modul: `gps-analytics`
```
apps/backend/src/gps-analytics/
├── gps-analytics.module.ts
├── gps-analytics.controller.ts
├── gps-analytics.service.ts
└── dto/
    └── vehicle-analytics.dto.ts
```

#### 2. API Endpoints

```typescript
GET /api/gps-analytics/vehicle
Query parameters:
  - vehicleId: number (required)
  - startDate: ISO 8601 string (required)
  - endDate: ISO 8601 string (required)

Response: VehicleAnalyticsDto {
  // Osnovne metrike
  totalPoints: number;
  totalDistance: number; // km
  avgSpeed: number; // km/h
  maxSpeed: number; // km/h
  drivingHours: number;
  idleTime: number; // hours
  totalStops: number;
  efficiency: number; // 0-100%
  
  // Podaci za grafikone
  hourlyData: Array<{
    hour: string; // "00", "01", ... "23"
    distance: number;
    avgSpeed: number;
    points: number;
  }>;
  
  speedDistribution: Array<{
    range: string; // "0-20", "20-40", etc
    count: number;
    percentage: number;
  }>;
  
  // routeStats - za sada preskačemo, dodaćemo u drugom krugu
  
  dailyStats: Array<{
    date: string;
    distance: number;
    drivingHours: number;
    avgSpeed: number;
  }>;
}
```

#### 3. SQL upiti za TimescaleDB

```sql
-- Osnovna statistika
WITH vehicle_data AS (
  SELECT 
    COUNT(*) as total_points,
    AVG(speed) FILTER (WHERE speed > 0) as avg_speed,
    MAX(speed) as max_speed,
    MIN(time) as start_time,
    MAX(time) as end_time
  FROM gps_data
  WHERE vehicle_id = $1
    AND time BETWEEN $2 AND $3
),
route_calculation AS (
  SELECT 
    ST_Length(
      ST_MakeLine(location ORDER BY time)::geography
    ) / 1000.0 as total_distance
  FROM gps_data
  WHERE vehicle_id = $1
    AND time BETWEEN $2 AND $3
    AND speed > 0
)
SELECT * FROM vehicle_data, route_calculation;

-- Hourly agregacija
SELECT 
  EXTRACT(HOUR FROM time) as hour,
  COUNT(*) as points,
  AVG(speed) FILTER (WHERE speed > 0) as avg_speed,
  ST_Length(
    ST_MakeLine(location ORDER BY time)::geography
  ) / 1000.0 as distance
FROM gps_data
WHERE vehicle_id = $1
  AND time BETWEEN $2 AND $3
GROUP BY EXTRACT(HOUR FROM time)
ORDER BY hour;

-- Detektovanje zaustavljanja
WITH stop_detection AS (
  SELECT 
    time,
    speed,
    LAG(speed) OVER (ORDER BY time) as prev_speed,
    LEAD(speed) OVER (ORDER BY time) as next_speed
  FROM gps_data
  WHERE vehicle_id = $1
    AND time BETWEEN $2 AND $3
)
SELECT COUNT(*) as stops
FROM stop_detection
WHERE speed = 0 
  AND prev_speed > 0 
  AND next_speed > 0;
```

### Frontend struktura

#### 1. Nova komponenta
```
apps/admin-portal/src/pages/transport/dispatcher/
└── VehicleAnalytics.tsx
```

#### 2. Dependencies
```json
{
  "@ant-design/plots": "^2.1.0",
  "dayjs": "^1.11.0",
  "axios": "^1.6.0"
}
```

#### 3. Komponente struktura
```tsx
VehicleAnalytics
├── Header (vehicle & date selection)
├── LoadingState
├── EmptyState
└── AnalyticsContent
    ├── KPICards
    │   ├── PrimaryMetrics
    │   └── SecondaryMetrics
    ├── Charts
    │   ├── SpeedLineChart
    │   ├── DistanceColumnChart
    │   └── EfficiencyGauge
    ├── SpeedDistribution
    └── DataTables
        ├── RouteStatsTable
        └── DailyStatsTable
```

### Optimizacije

#### 1. Caching strategija
- Redis cache za agregiranu analitiku (TTL: 5 minuta)
- Key format: `analytics:vehicle:${vehicleId}:${startDate}:${endDate}`

#### 2. Performance
- Koristiti TimescaleDB continuous aggregates za brže učitavanje
- Lazy loading za grafikone
- Virtual scrolling za velike tabele

#### 3. Error handling
- Graceful degradation ako nema podataka
- Retry logika za failed requests
- User-friendly error poruke

## 📝 Faze implementacije

### Faza 1: Backend (2h)
- [x] Plan i struktura
- [ ] Kreirati gps-analytics modul
- [ ] Implementirati service sa SQL upitima
- [ ] Kreirati controller i DTO
- [ ] Testirati sa postojećim podacima

### Faza 2: Frontend osnova (1h)
- [ ] Kreirati VehicleAnalytics komponentu
- [ ] Implementirati vehicle i date selekciju
- [ ] Dodati rutu i meni opciju
- [ ] Povezati sa API-jem

### Faza 3: KPI Dashboard (1h)
- [ ] Implementirati KPI kartice
- [ ] Dodati loading i empty states
- [ ] Stilizovati sa Ant Design

### Faza 4: Grafikoni (2h)
- [ ] Integrirati @ant-design/plots
- [ ] Implementirati sve grafikone
- [ ] Dodati animacije i interakcije

### Faza 5: Tabele i finalizacija (1h)
- [ ] Dodati tabelarne prikaze
- [ ] Testirati sa različitim vozilima
- [ ] Fine-tuning i optimizacije

## 🎨 UI/UX Smernice

### Boje
- Primary: #1890ff (Ant Design blue)
- Success: #52c41a (zelena za dobre metrike)
- Warning: #faad14 (žuta za upozorenja)
- Error: #f5222d (crvena za prekoračenja)

### Layout
- Responsive grid: 24 kolone
- Card-based dizajn sa senkom
- Consistent spacing: 16px gutter

### Interakcije
- Hover efekti na karticama
- Smooth animacije grafikona
- Loading skeleton umesto spinner-a

## 🔐 Sigurnosni aspekti

1. **Autorizacija**
   - Permission: `dispatcher:view_analytics`
   - Role check pre učitavanja podataka

2. **Validacija**
   - Provera vehicle ownership
   - Date range ograničenja (max 90 dana)

3. **Rate limiting**
   - Max 100 requests/min po korisniku
   - Cache za identične upite

## 📊 Primeri podataka

### Test vozilo: P93597
- Garažni broj: P93597
- Registracija: BG-123-AB
- Period: 31.08.2024
- Očekivani rezultati:
  - ~600 GPS tačaka
  - ~7.2 km ukupna kilometraža
  - Prosečna brzina: ~25 km/h

## 🚀 Deployment checklist

- [ ] Environment varijable za TimescaleDB
- [ ] Redis cache konfiguracija
- [ ] API rate limiting
- [ ] Monitoring i logging
- [ ] Performance testiranje
- [ ] Dokumentacija za korisnike

## 📚 Reference

- [TimescaleDB Docs](https://docs.timescale.com/)
- [PostGIS Functions](https://postgis.net/docs/reference.html)
- [Ant Design Charts](https://charts.ant.design/)
- [Ant Design Plots](https://g2plot.antv.vision/)

---

*Poslednje ažuriranje: 31.08.2024*
*Verzija: 1.0.0*