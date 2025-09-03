# 📊 Monthly Report Optimizacija - TODO Lista

## 📅 Datum kreiranja: 03.09.2025
## 🎯 Cilj: Optimizacija Monthly Report sa 40s/2 vozila na <1s/1200 vozila
## ⏱️ Procenjena dužina implementacije: 2-3 dana

---

## 🔴 KRITIČAN PROBLEM
- **Trenutno**: 40 sekundi za 2 vozila (20s po vozilu)
- **Projekcija**: 6.7 SATI za 1200 vozila
- **Cilj**: <1 sekunda za 1200 vozila (4800x brže!)

---

## 📋 FAZA 1: Analiza i priprema (Dan 1 - Jutro)

### 1.1 Backup postojećeg sistema
- [ ] Kreirati backup trenutnih PostGIS funkcija
- [ ] Dokumentovati trenutnu safety score formulu
- [ ] Sačuvati SQL dump postojećih agregata
- [ ] Kreirati test dataset sa 50-100 vozila

### 1.2 Performance testing
- [ ] Izmeriti tačno vreme za različite brojeve vozila (2, 10, 50, 100)
- [ ] Identifikovati najsporije query-je pomoću EXPLAIN ANALYZE
- [ ] Profilisati frontend - meriti vreme svakog API poziva
- [ ] Dokumentovati baseline performanse

### 1.3 Priprema infrastrukture
- [ ] Proveriti da li postoje svi potrebni indeksi na TimescaleDB
- [ ] Proveriti compression policy na chunk-ovima
- [ ] Proveriti refresh policy postojećih continuous aggregates

---

## 📋 FAZA 2: Kreiranje Continuous Aggregates (Dan 1 - Popodne)

### 2.1 Kreiranje monthly_vehicle_raw_stats aggregate
- [ ] Definisati strukturu sa SAMO sirovim podacima (brojači eventi)
- [ ] NE uključivati safety score formulu
- [ ] Uključiti: severe_acc, moderate_acc, severe_brake, moderate_brake
- [ ] Uključiti: avg_g_force, max_g_force, total_events
- [ ] Testirati sa malim datasetom prvo

### 2.2 Kreiranje monthly_distance_stats aggregate
- [ ] Agregirati kilometražu iz gps_data tabele
- [ ] Koristiti PostGIS ST_Distance funkcije
- [ ] Optimizovati za velike količine GPS podataka
- [ ] Testirati tačnost kalkulacije

### 2.3 Kreiranje weekly i daily agregata (opciono)
- [ ] Weekly agregati za nedeljne izveštaje
- [ ] Daily agregati za dashboard preglede
- [ ] Hijerarhijski agregati (daily -> weekly -> monthly)

### 2.4 Podešavanje refresh policy
- [ ] Automatski refresh svakih sat vremena
- [ ] Backfill istorijskih podataka
- [ ] Monitoring refresh job-ova

---

## 📋 FAZA 3: Backend optimizacija (Dan 2 - Jutro)

### 3.1 Kreiranje batch API endpoint-a
- [ ] POST /api/driving-behavior/batch-monthly-statistics
- [ ] Prihvata listu vehicle ID-jeva i datum range
- [ ] Vraća sve statistike odjednom
- [ ] Paralelno čitanje iz agregata

### 3.2 Refaktorisanje safety score logike
- [ ] Izdvojiti safety score formulu iz PostGIS funkcije
- [ ] Kreirati TypeScript funkciju za kalkulaciju
- [ ] Omogućiti konfigurabilnost formule
- [ ] Dodati podršku za različite verzije formule

### 3.3 Kreiranje sistema za upravljanje formulama
- [ ] Tabela u bazi za čuvanje formula
- [ ] API za CRUD operacije nad formulama
- [ ] Verzionisanje formula sa datumima validnosti
- [ ] Admin UI za upravljanje formulama

### 3.4 Optimizacija postojećih endpoint-a
- [ ] Dodati caching layer sa Redis-om
- [ ] Implementirati pagination za velike dataset-e
- [ ] Dodati request batching

---

## 📋 FAZA 4: Frontend optimizacija (Dan 2 - Popodne)

### 4.1 Refaktorisanje MonthlyReport komponente
- [ ] Zameniti sekvencijalne pozive sa jednim batch pozivom
- [ ] Ukloniti for petlju kroz vozila
- [ ] Implementirati loading state po sekcijama
- [ ] Dodati progress bar za velike izveštaje

### 4.2 Implementacija paginacije
- [ ] Podela vozila na stranice (50-100 po stranici)
- [ ] Virtual scrolling za velike tabele
- [ ] Lazy loading podataka

### 4.3 Optimizacija PDF generisanja
- [ ] Generisanje PDF-a u pozadini
- [ ] Streaming PDF generisanje za velike izveštaje
- [ ] Opcija za asinhrono slanje na email

### 4.4 Dodavanje cache strategije
- [ ] Cache rezultata na frontend-u
- [ ] Invalidacija cache-a pri promeni datuma
- [ ] Optimistic updates

---

## 📋 FAZA 5: Testing i fine-tuning (Dan 3 - Jutro)

### 5.1 Load testing
- [ ] Test sa 100 vozila
- [ ] Test sa 500 vozila
- [ ] Test sa 1200 vozila
- [ ] Test sa različitim datumskim opsezima

### 5.2 Poređenje performansi
- [ ] Meriti vreme pre i posle optimizacije
- [ ] Dokumentovati poboljšanja
- [ ] Identifikovati preostale bottleneck-e

### 5.3 Validacija podataka
- [ ] Uporediti rezultate stare i nove implementacije
- [ ] Proveriti tačnost safety score kalkulacije
- [ ] Proveriti tačnost agregiranih podataka

### 5.4 Error handling
- [ ] Dodati graceful degradation
- [ ] Fallback na staru implementaciju ako agregati nisu spremni
- [ ] Logovanje grešaka i monitoring

---

## 📋 FAZA 6: Deployment i monitoring (Dan 3 - Popodne)

### 6.1 Deployment strategija
- [ ] Kreirati feature flag za novu implementaciju
- [ ] Postupni rollout (10% -> 50% -> 100%)
- [ ] A/B testing sa starom implementacijom
- [ ] Rollback plan

### 6.2 Monitoring setup
- [ ] Dodati metrike za aggregate refresh
- [ ] Monitoring query performansi
- [ ] Alert za spore query-je (>5s)
- [ ] Dashboard za praćenje korišćenja

### 6.3 Dokumentacija
- [ ] Ažurirati API dokumentaciju
- [ ] Kreirati migration guide
- [ ] Dokumentovati nove aggregate strukture
- [ ] Kreirati troubleshooting guide

### 6.4 Training i komunikacija
- [ ] Obučiti tim za održavanje agregata
- [ ] Informisati stakeholder-e o poboljšanjima
- [ ] Kreirati user guide za nove funkcionalnosti

---

## 🎯 SUCCESS CRITERIA

### Performanse
- ✅ Vreme generisanja za 1200 vozila < 1 sekunda
- ✅ Pojedinačni query < 100ms
- ✅ PDF generisanje < 5 sekundi

### Funkcionalnost
- ✅ Safety score formula može da se menja bez downtime
- ✅ Podaci su identični sa starom implementacijom
- ✅ Svi postojeći izveštaji rade

### Skalabilnost
- ✅ Sistem podržava 5000+ vozila
- ✅ Agregati se automatski osvežavaju
- ✅ Minimalna upotreba resursa

---

## 🔧 TEHNIČKI DETALJI

### TimescaleDB verzija
- Minimum: 2.11+
- PostGIS: 3.0+
- Compression: Enabled

### Backend stack
- NestJS 10+
- TypeScript 5+
- Node.js 18+

### Potrebni resursi
- 2 developera (backend + frontend)
- TimescaleDB admin pristup
- Test environment sa production-like podacima

---

## 📝 NAPOMENE

### Rizici
1. Aggregate refresh može da kasni pri velikom opterećenju
2. Formula migracija može biti kompleksna
3. Potrebno je paziti na timezone handling

### Alternativna rešenja
1. Materialized views u PostgreSQL (bez TimescaleDB)
2. Preprocessing sa cron job-ovima
3. Dedicated OLAP baza

### Kontakt osobe
- Backend lead: [TBD]
- DBA: [TBD]
- Product owner: [TBD]

---

## 📊 PROGRESS TRACKING

### Dan 1
- [x] Faza 1 završena
- [x] Faza 2 započeta
- [x] Blocker-i identifikovani

#### Identifikovani problemi:
- **KRITIČNO**: ST_Distance kalkulacija traje 12+ sekundi po vozilu!
- Postojeća funkcija `get_vehicle_driving_statistics` je prespora
- Nedostajali su indeksi (dodati)
- Continuous aggregates moraju biti jednostavniji zbog TimescaleDB ograničenja

### Dan 2
- [ ] Faza 3 završena
- [ ] Faza 4 završena
- [ ] Integracija testirana

### Dan 3
- [ ] Faza 5 završena
- [ ] Faza 6 u toku
- [ ] Production ready

---

*Poslednje ažuriranje: 03.09.2025 17:45*
*Sledeći review: [TBD]*