# 📋 TODO: Sistem za rekreaciju driving_events podataka

## 📍 Lokacija u meniju
- **Putanja**: Autobuski prevoznici → Bezbednost → Rekreacija podataka
- **Pozicija**: Ispod "Mesečni izveštaj"
- **Permisija**: `safety.data-recreation:manage`

## 🎯 Cilj
Omogućiti administratorima da naknadno rekreiraju podatke o agresivnoj vožnji (driving_events) za selektovana vozila i vremenski period, sa detaljnim praćenjem progresa.

## 📝 TODO Lista

### 1. Backend infrastruktura

#### 1.1 Database
- [ ] Kreirati Prisma migraciju za novu tabelu `driving_analysis_logs`
```sql
CREATE TABLE driving_analysis_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  vehicle_ids INTEGER[],
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  total_vehicles INTEGER NOT NULL,
  processed_vehicles INTEGER DEFAULT 0,
  total_events_detected INTEGER DEFAULT 0,
  total_events_before INTEGER DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  strategy VARCHAR(20) NOT NULL DEFAULT 'daily',
  clear_existing BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  vehicle_progress JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] Dodati indekse za performanse
```sql
CREATE INDEX idx_driving_analysis_logs_status ON driving_analysis_logs(status);
CREATE INDEX idx_driving_analysis_logs_user_id ON driving_analysis_logs(user_id);
CREATE INDEX idx_driving_analysis_logs_created_at ON driving_analysis_logs(created_at DESC);
```

#### 1.2 Permisije
- [ ] Kreirati Prisma migraciju za novu permisiju
```sql
INSERT INTO permissions (name, resource, action, description, description_sr, category)
VALUES (
  'safety.data-recreation:manage',
  'safety.data-recreation',
  'manage',
  'Manage driving events data recreation',
  'Upravljanje rekreacijom podataka o vožnji',
  'safety'
);
```

#### 1.3 Backend modul
- [ ] Kreirati novi modul `DrivingRecreationModule`
- [ ] Kreirati `DrivingRecreationService` sa metodama:
  - `getVehiclesWithStats(startDate, endDate)` - vozila sa brojem GPS tačaka
  - `startRecreation(params: RecreationParams)` - pokreće proces
  - `getRecreationStatus(id: number)` - vraća trenutni status
  - `stopRecreation(id: number)` - zaustavlja proces
  - `getRecreationHistory(userId?: number)` - istorija rekreacija
  - `getVehicleEventsCount(vehicleId, startDate, endDate)` - broj postojećih događaja

- [ ] Kreirati `DrivingRecreationController` sa endpoint-ima:
  - `GET /api/driving-recreation/vehicles` - lista vozila sa statistikom
  - `POST /api/driving-recreation/start` - pokreće rekreaciju
  - `GET /api/driving-recreation/status/:id` - status rekreacije
  - `DELETE /api/driving-recreation/stop/:id` - zaustavlja rekreaciju
  - `GET /api/driving-recreation/history` - istorija
  - `POST /api/driving-recreation/preview` - preview broj događaja

#### 1.4 DTOs
```typescript
interface RecreationParamsDto {
  vehicleIds: number[];
  startDate: string;
  endDate: string;
  clearExisting: boolean;
  strategy: 'daily' | 'bulk';
  notifyOnComplete?: boolean;
}

interface RecreationStatusDto {
  id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalVehicles: number;
  processedVehicles: number;
  currentVehicle?: {
    id: number;
    garageNo: string;
    progress: number;
    eventsDetected: number;
  };
  vehicles: VehicleProgressDto[];
  startedAt: Date;
  estimatedCompletion?: Date;
  totalEventsDetected: number;
  totalEventsBefore: number;
}

interface VehicleProgressDto {
  id: number;
  garageNo: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  eventsDetected?: number;
  eventsBefore?: number;
  error?: string;
  processingTime?: number;
}
```

#### 1.5 WebSocket implementacija
- [ ] Kreirati WebSocket Gateway za real-time updates
- [ ] Emitovati eventi:
  - `recreation:started` - kada počne proces
  - `recreation:progress` - update progresa (svakih 5%)
  - `recreation:vehicle-completed` - kada se završi vozilo
  - `recreation:completed` - kada se završi ceo proces
  - `recreation:error` - u slučaju greške

### 2. Frontend implementacija

#### 2.1 Nova stranica
- [ ] Kreirati `/apps/admin-portal/src/pages/transport/safety/DataRecreation.tsx`

#### 2.2 Komponente

##### A. Selekcija vozila
- [ ] Tabela sa kolonama:
  - Checkbox za selekciju
  - Garažni broj
  - Registracija
  - Status (active/inactive)
  - Broj GPS tačaka u periodu
  - Postojeći događaji u periodu
- [ ] "Select All" / "Deselect All" funkcionalnost
- [ ] Search/filter po garažnom broju
- [ ] Pagination (20 vozila po stranici)
- [ ] Sortiranje po kolonama

##### B. Vremesnki period
- [ ] RangePicker komponenta (Ant Design)
- [ ] Preset opcije:
  - Danas
  - Juče
  - Poslednih 7 dana
  - Poslednji mesec
  - Poslednja 3 meseca
  - Custom range
- [ ] Validacija:
  - End date ne može biti u budućnosti
  - Maksimalni period 6 meseci
  - Start date pre end date
- [ ] Prikaz: "Period: X dana"

##### C. Opcije rekreacije
- [ ] Switch: "Obriši postojeće događaje pre analize"
- [ ] Radio grupa za strategiju:
  - "Dan po dan (preporučeno za velike periode)"
  - "Ceo period odjednom (brže za kratke periode)"
- [ ] Info alert sa objašnjenjem opcija

##### D. Kontrolno dugme
- [ ] "Pokreni rekreaciju" dugme
  - Disabled ako nema selektovanih vozila
  - Prikazuje broj selektovanih vozila
- [ ] Confirmation modal pre pokretanja:
  - Rezime: X vozila, period od-do
  - Upozorenje ako je "obriši postojeće" uključeno
  - Procena vremena izvršavanja

##### E. Progress modal
- [ ] Modal koji se automatski otvara kad počne proces
- [ ] Glavni progress bar (ukupan napredak)
- [ ] Lista vozila sa individual progress:
  ```
  🟡 P93597 - Čeka na obradu
  🔄 P93598 - U obradi (45%)
  ✅ P93599 - Završeno (123 događaja)
  ❌ P93600 - Greška
  ```
- [ ] Real-time update preko WebSocket-a
- [ ] Statistika:
  - Vreme početka
  - Procenjeno vreme završetka
  - Brzina procesiranja (vozila/minut)
- [ ] "Prekini" dugme sa konfirmacijom

##### F. Rezultati
- [ ] Tabela sa rezultatima nakon završetka:
  - Vozilo (garažni broj)
  - Događaji pre rekreacije
  - Događaji posle rekreacije
  - Razlika (+/-)
  - Harsh acceleration
  - Harsh braking
  - Status
- [ ] Summary card sa ukupnom statistikom
- [ ] Export u CSV/Excel

##### G. Istorija rekreacija
- [ ] Tab sa istorijom prethodnih rekreacija
- [ ] Tabela sa kolonama:
  - Datum/vreme
  - Korisnik
  - Broj vozila
  - Period
  - Status
  - Detektovani događaji
  - Akcije (Pregled detalja)

#### 2.3 API Service
- [ ] Kreirati `drivingRecreationService.ts`
```typescript
class DrivingRecreationService {
  async getVehiclesWithStats(startDate: string, endDate: string);
  async startRecreation(params: RecreationParams);
  async getStatus(id: number);
  async stopRecreation(id: number);
  async getHistory(page: number, limit: number);
  async previewEventsCount(vehicleIds: number[], startDate: string, endDate: string);
}
```

#### 2.4 WebSocket klijent
- [ ] Implementirati Socket.io klijent za real-time updates
- [ ] Subscribe na recreation eventi
- [ ] Update UI na osnovu primljenih podataka

### 3. Optimizacije i performanse

#### 3.1 Backend optimizacije
- [ ] Batch processing - max 3 vozila paralelno
- [ ] Connection pooling za TimescaleDB
- [ ] Chunking za velike periode (30+ dana)
- [ ] Rate limiting - pauza između batch-eva
- [ ] Queue sistem za managing multiple requests

#### 3.2 Frontend optimizacije
- [ ] Virtual scrolling za velike liste vozila
- [ ] Debounce za search input
- [ ] Memoizacija za expensive kalkulacije
- [ ] Lazy loading komponenti

### 4. Error handling i logging

- [ ] Comprehensive error handling na backend-u
- [ ] Retry logika za failed vozila
- [ ] Detaljan logging u `driving_analysis_logs` tabelu
- [ ] Frontend error boundaries
- [ ] User-friendly error poruke

### 5. Testing

- [ ] Unit testovi za service metode
- [ ] Integration testovi za API endpoints
- [ ] E2E testovi za ceo flow
- [ ] Performance testovi sa 100+ vozila
- [ ] Test različitih strategija (daily vs bulk)

### 6. Dokumentacija

- [ ] API dokumentacija (Swagger)
- [ ] Korisničko uputstvo
- [ ] Tehnička dokumentacija
- [ ] Troubleshooting guide

## 🚀 Redosled implementacije

1. **Faza 1: Backend osnove**
   - Database migracije
   - Osnovni servis i controller
   - CRUD operacije

2. **Faza 2: Core funkcionalnost**
   - Implementacija rekreacije
   - Progress tracking
   - Error handling

3. **Faza 3: Frontend osnove**
   - Stranica i routing
   - Tabela vozila
   - Date picker

4. **Faza 4: Real-time features**
   - WebSocket implementacija
   - Progress modal
   - Live updates

5. **Faza 5: Polish**
   - Optimizacije
   - Testing
   - Dokumentacija

## 📊 Procena vremena

- Backend: 2-3 dana
- Frontend: 2-3 dana
- Testing: 1 dan
- Dokumentacija: 0.5 dana

**Ukupno: ~1 nedelja**

## ⚠️ Napomene

1. Koristiti postojeću `detect_aggressive_driving_batch` funkciju
2. Za velike periode (>30 dana) obavezno koristiti "daily" strategiju
3. Maksimalno 3 vozila paralelno da ne opteretimo DB
4. Implementirati graceful shutdown za prekidanje procesa
5. Čuvati log svake rekreacije za audit trail