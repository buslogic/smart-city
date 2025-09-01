# 🚨 Plan implementacije sistema za detekciju agresivne vožnje

## 📊 Pregled postojeće infrastrukture

### Trenutno stanje
- **TimescaleDB sa PostGIS 3.5** - potpuno funkcionalna baza za GPS time-series podatke
- **Hypertable struktura** - optimizovana za velike količine GPS podataka sa automatskom particijom
- **PostGIS ekstenzija** - omogućava napredne geo-spatial kalkulacije
- **GPS uzorkovanje** - podaci se čuvaju na svakih 3 sekunde
- **Postojeće kolone**: lat, lng, speed, time, vehicle_id, garage_no

## 🎯 Cilj sistema

Kreiranje sistema koji na osnovu GPS podataka detektuje i klasifikuje agresivno ponašanje vozača kroz:
- **Agresivno ubrzanje** (3 nivoa: blago, srednje, jako)
- **Agresivno kočenje** (3 nivoa: blago, srednje, jako)
- **Analiza po vozilu i periodu**
- **Real-time monitoring i alerting**

## 📐 Matematičke formule za detekciju

### Osnovna formula za ubrzanje/usporenje
```
a = Δv / Δt

gde je:
- a = ubrzanje/usporenje (m/s²)
- Δv = promena brzine (m/s)
- Δt = vremenski interval (s)
```

### Klasifikacija nivoa (industriski standard)

**Ubrzanje:**
- Normalno: 0 - 2.5 m/s²
- Srednje agresivno: 2.5 - 4.0 m/s²
- Jako agresivno: > 4.0 m/s²

**Kočenje (negativno ubrzanje):**
- Normalno: 0 - (-2.5) m/s²
- Srednje agresivno: -2.5 - (-4.5) m/s²
- Jako agresivno: < -4.5 m/s²

### Dodatne metrike
- **G-force**: a / 9.81 (za lakše razumevanje intenziteta)
- **Jerk (trzaj)**: Δa / Δt (promena ubrzanja kroz vreme)
- **Lateralno ubrzanje**: kalkulisano kroz promenu kursa

## 🏗️ Arhitektura rešenja

### 1. Proširenje TimescaleDB strukture

**Nova tabela za driving events:**
```sql
driving_events (
  id SERIAL,
  time TIMESTAMPTZ,
  vehicle_id INTEGER,
  garage_no VARCHAR(20),
  event_type VARCHAR(50), -- 'acceleration', 'braking', 'cornering'
  severity VARCHAR(20), -- 'normal', 'moderate', 'severe'
  value NUMERIC(5,2), -- m/s²
  g_force NUMERIC(4,2),
  speed_before NUMERIC(5,2),
  speed_after NUMERIC(5,2),
  duration_ms INTEGER,
  location GEOMETRY(Point, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

**Continuous aggregate za statistike:**
```sql
vehicle_behavior_daily (
  day DATE,
  vehicle_id INTEGER,
  garage_no VARCHAR(20),
  total_events INTEGER,
  severe_accelerations INTEGER,
  moderate_accelerations INTEGER,
  severe_brakings INTEGER,
  moderate_brakings INTEGER,
  avg_g_force NUMERIC,
  distance_km NUMERIC,
  safety_score INTEGER -- 0-100
)
```

### 2. Backend moduli (NestJS)

**Novi modul: `/driving-behavior`**
- `DrivingBehaviorModule` - glavni modul
- `DrivingBehaviorService` - poslovna logika
- `EventDetectionService` - real-time detekcija
- `DrivingBehaviorController` - API endpoints

**Funkcionalnosti:**
- Real-time analiza incoming GPS podataka
- Batch procesiranje istorijskih podataka
- Generisanje izveštaja po vozilu/vozaču
- Safety score kalkulacija
- WebSocket notifikacije za kritične događaje

### 3. PostGIS funkcije za detekciju

**Stored procedure za kalkulaciju ubrzanja:**
```sql
CREATE FUNCTION calculate_acceleration_events(
  p_vehicle_id INTEGER,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ
)
```

**Funkcija koristi:**
- LAG/LEAD window funkcije za pristup prethodnim/sledećim tačkama
- ST_Distance za preciznu kalkulaciju pređenog puta
- Filtriranje noise-a (greške GPS signala)
- Smoothing algoritam za realniji rezultat

### 4. Frontend komponente (Admin Portal)

**Nova stranica: `/transport/safety/aggressive-driving`**

**Komponente:**
- `AggressiveDrivingDashboard` - glavni dashboard
- `EventsTable` - tabela sa događajima
- `VehicleHeatmap` - Leaflet mapa sa heatmapom događaja
- `DriverScoreCard` - safety score prikaz
- `RealTimeAlerts` - live notifikacije

**Vizualizacije (korišćenje postojećih biblioteka):**
- **Recharts** - grafikoni ubrzanja kroz vreme
- **Leaflet.heat** - heatmapa kritičnih zona
- **Ant Design Plots** - statistički grafikoni

## 🔄 Proces rada sistema

### Real-time detekcija
1. GPS podatak stiže kroz GPS Sync
2. EventDetectionService analizira poslednje 3-5 tačaka
3. Kalkuliše se ubrzanje/usporenje
4. Ako prelazi prag, kreira se event
5. WebSocket šalje notifikaciju
6. Frontend prikazuje alert

### Batch analiza
1. CRON job na svakih 15 minuta
2. Procesira neprocesuirane GPS podatke
3. Generiše driving events
4. Ažurira continuous aggregate
5. Kalkuliše safety score

### Izveštavanje
1. Korisnik bira vozilo i period
2. Query na driving_events i aggregates
3. PostGIS funkcije za geo-analizu
4. Generisanje PDF/Excel izveštaja

## 🎯 Ključne prednosti korišćenja PostGIS-a

1. **ST_MakeLine** - automatsko kreiranje rute
2. **ST_Distance** - precizna kalkulacija rastojanja
3. **ST_DWithin** - pronalaženje događaja u radiusu
4. **ST_Collect/ST_Centroid** - grupisanje i analiza zona
5. **Geography tip** - kalkulacije na sfernoj površini Zemlje

## 📊 Metrije i KPI

### Po vozilu
- Broj agresivnih događaja po 100km
- Prosečan safety score
- Trend poboljšanja/pogoršanja
- Poređenje između vozila iste garaže
- Analiza po vremenskim periodima

## 🚀 MVP PRISTUP (BRŽA IMPLEMENTACIJA)

### 🎯 MVP Strategija - BEZ Continuous Aggregates
**Cilj:** Što pre dobiti funkcionalne dijagrame i statistiku

#### Zašto preskačemo Continuous Aggregates za MVP:
- Jednostavniji setup (samo 1 tabela)
- Lakše debugging i izmene
- Brži development (2-3 dana uštede)
- Statistike računamo "on-the-fly" (dovoljno brzo za < 10k events po vozilu)

### MVP Faza 1 - Batch analiza postojećih podataka (2 dana)
- Kreiranje samo `driving_events` tabele
- PostGIS funkcija koja procesira postojeće GPS podatke
- Jednokratni SQL script za analizu svih vozila
- Popunjavanje `driving_events` sa istorijskim podacima

### MVP Faza 2 - Backend API (2 dana)
- Jednostavan NestJS modul
- 3 osnovna endpoint-a:
  - GET /vehicle/:id/aggressive-events
  - GET /vehicle/:id/statistics (kalkuliše u realnom vremenu)
  - GET /vehicle/:id/chart-data
- Direktni SQL upiti bez ORM komplikacija

### MVP Faza 3 - Frontend Dashboard (2-3 dana)
- Jedna stranica sa 3 sekcije:
  - Statistika kartica (broj eventi, prosek po danu)
  - Grafikon ubrzanja/kočenja kroz vreme
  - Tabela sa listom agresivnih događaja
- Koristi postojeće komponente (Ant Design, Recharts)

### MVP Faza 4 - Integracija sa GPS Sync (1 dan)
- Dodati hook u postojeći GPS Sync
- Kada novi GPS podaci stignu, procesirati ih
- Insertovati nove events u `driving_events`

## 🚀 KASNIJE (Post-MVP)
- Continuous aggregates za performanse
- Real-time WebSocket notifikacije
- Heatmape i geo-analize
- PDF/Excel export
- Safety score sistem

## 🔧 Tehnički zahtevi

### Performanse
- Procesiranje 1000+ vozila u real-time
- Query response < 500ms
- Alert latency < 2s

### Skalabilnost
- Horizontalno particioniranje po vehicle_id
- Compression starijih podataka
- Archiving nakon 90 dana

### Integracija
- REST API za eksterne sisteme
- WebSocket za real-time
- MQTT opciono za IoT uređaje

## 📝 Napomene

- Pragovi za detekciju su konfigurabilan parametri
- Sistem mora uzeti u obzir tip vozila (autobus vs automobil)
- GPS greške se filtriraju kroz smoothing algoritme
- Svi eventi se loguju za audit trail
- GDPR compliance za podatke o vozačima

## ✅ MVP TASK LISTA (7-8 DANA TOTAL)

### 🚀 DAN 1-2: Database & Batch Processing
- [ ] Kreirati SQL za `driving_events` tabelu (SAMO OVA TABELA)
- [ ] Kreirati PostGIS funkciju za kalkulaciju ubrzanja između GPS tačaka
- [ ] Napisati SQL script za batch analizu postojećih GPS podataka
- [ ] Testirati sa podacima vozila P93597 (imamo 604 GPS tačke)
- [ ] Popuniti `driving_events` tabelu sa istorijskim podacima

### 🚀 DAN 3-4: Backend API
- [ ] Kreirati `driving-behavior` modul u NestJS
- [ ] Implementirati 3 endpoint-a:
  - [ ] GET /api/driving-behavior/vehicle/:id/events?startDate=&endDate=
  - [ ] GET /api/driving-behavior/vehicle/:id/statistics?startDate=&endDate=
  - [ ] GET /api/driving-behavior/vehicle/:id/chart-data?startDate=&endDate=
- [ ] Testirati sa Postman/Swagger

### 🚀 DAN 5-7: Frontend Dashboard
- [ ] Kreirati rutu `/transport/safety/aggressive-driving` u Admin Portal
- [ ] Implementirati Dashboard sa 3 komponente:
  - [ ] StatisticsCards (broj eventi, proseci)
  - [ ] AccelerationChart (Recharts line graph)
  - [ ] EventsTable (Ant Design table)
- [ ] Dodati vehicle selector i date range picker
- [ ] Testirati sa stvarnim podacima

### 🚀 DAN 8: GPS Sync Integracija
- [ ] Modificirati `GpsSyncService` da poziva detekciju
- [ ] Testirati da novi GPS podaci generišu events
- [ ] Verifikovati da dashboard pokazuje najnovije podatke

## ✅ ORIGINALNA TASK LISTA (ZA KASNIJE)

### 🔧 FAZA 2: Backend Implementation (NestJS)
- [ ] Kreirati `driving-behavior` modul
- [ ] Implementirati `DrivingBehaviorService`
  - [ ] Metoda za real-time detekciju ubrzanja/kočenja
  - [ ] Metoda za batch procesiranje istorijskih podataka
  - [ ] Metoda za kalkulaciju safety score
  - [ ] Metoda za generisanje statistika po vozilu
- [ ] Kreirati `EventDetectionService`
  - [ ] Algoritam za detekciju agresivnog ubrzanja
  - [ ] Algoritam za detekciju agresivnog kočenja
  - [ ] Noise filtering za GPS greške
  - [ ] Smoothing algoritam (moving average)
- [ ] Implementirati `DrivingBehaviorController`
  - [ ] GET /driving-behavior/vehicle/:id/events
  - [ ] GET /driving-behavior/vehicle/:id/statistics
  - [ ] GET /driving-behavior/vehicle/:id/safety-score
  - [ ] POST /driving-behavior/analyze (za batch analizu)
- [ ] Kreirati DTO klase za request/response
- [ ] Dodati Swagger dokumentaciju
- [ ] Napisati unit testove za servise
- [ ] Integrisati sa postojećim GPS Sync modulom

### 🎨 FAZA 3: Frontend Implementation (Admin Portal)
- [ ] Kreirati novu rutu `/transport/safety/aggressive-driving`
- [ ] Implementirati `AggressiveDrivingDashboard` komponentu
  - [ ] Layout sa Ant Design Grid sistemom
  - [ ] Safety score cards sa Statistic komponentom
  - [ ] Filteri (vozilo, datum range, severity)
- [ ] Kreirati `DrivingEventsTable` komponentu
  - [ ] Ant Design Table sa sortiranjem i paginacijom
  - [ ] Severity badge komponente (crveno/žuto/zeleno)
  - [ ] Expandable rows za detalje događaja
- [ ] Implementirati `VehicleAccelerationChart`
  - [ ] Recharts line chart za ubrzanje kroz vreme
  - [ ] Označavanje agresivnih događaja na grafikonu
  - [ ] Zoom i pan funkcionalnost
- [ ] Kreirati `SafetyScoreCard` komponentu
  - [ ] Circular progress za score prikaz
  - [ ] Trend indikator (poboljšanje/pogoršanje)
  - [ ] Mini sparkline grafikon
- [ ] Implementirati `EventsHeatmap` sa Leaflet
  - [ ] Leaflet.heat plugin integracija
  - [ ] Clustering događaja po lokaciji
  - [ ] Popup sa detaljima na klik
- [ ] Kreirati servis `aggressiveDrivingService`
  - [ ] API pozivi ka backend-u
  - [ ] Zustand store za state management
  - [ ] React Query za caching
- [ ] Dodati navigaciju u MainLayout

### 🧪 FAZA 4: Testing & Optimization
- [ ] Napisati SQL skriptu za generisanje test podataka
- [ ] Testirati sa 1000+ GPS tačaka po vozilu
- [ ] Optimizovati PostGIS upite (EXPLAIN ANALYZE)
- [ ] Load testing sa Apache JMeter
- [ ] Fine-tuning pragova za detekciju
- [ ] Testirati različite scenarije:
  - [ ] Gradska vožnja vs autoput
  - [ ] Špic vs van špica
  - [ ] Različiti vremenski uslovi
- [ ] Dokumentovati API endpoints

### 🚀 FAZA 5: Deployment & Monitoring
- [ ] Kreirati migration skripte za produkciju
- [ ] Podesiti environment varijable
- [ ] Kreirati backup strategiju za events tabelu
- [ ] Podesiti monitoring (Grafana dashboards)
- [ ] Kreirati alerts za kritične događaje
- [ ] Dokumentacija za korisnike
- [ ] Training materijali za operatore

### 📈 FAZA 6: Dodatne funkcionalnosti (Opciono)
- [ ] Export u PDF/Excel
- [ ] Email notifikacije za kritične događaje
- [ ] Weekly/Monthly report generisanje
- [ ] Comparative analysis između vozila
- [ ] REST API za eksterne integracije
- [ ] Mobile app notifikacije

## 🎯 PRIORITETI ZA POČETAK

**Dan 1-2:** Database setup (FAZA 1)
**Dan 3-5:** Backend core funkcionalnosti (FAZA 2)
**Dan 6-8:** Frontend osnovni dashboard (FAZA 3)
**Dan 9-10:** Testing i optimizacija
**Dan 11-12:** Deployment priprema

## 📌 TRENUTNI STATUS: SPREMAN ZA START!