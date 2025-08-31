# Plan sinhronizacije vozila između Legacy i Smart City sistema

## 1. Pregled trenutne situacije

### Postojeće komponente
- **Legacy baza**: MySQL baza sa tabelom `bus_vehicle` (1,243 vozila)
- **Smart City baza**: MySQL baza sa tabelom `bus_vehicles` 
- **Povezivanje**: Kreiran mapping između tabela kroz `LegacyTableMapping`
- **Legacy ID**: Svako vozilo ima `legacy_id` polje za praćenje originala

### Izazovi
- Velika količina podataka (1,243+ vozila)
- Ne smemo opteretiti legacy bazu
- Potrebna inkrementalna sinhronizacija
- Praćenje promena i konflikata
- Potreban audit trail

## 2. Predlog arhitekture

### 2.1 Nova tabela za praćenje sinhronizacije

```prisma
model VehicleSyncLog {
  id              Int       @id @default(autoincrement())
  syncType        String    // 'full' | 'incremental' | 'manual'
  status          String    // 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  startedAt       DateTime
  completedAt     DateTime?
  totalRecords    Int       // Ukupan broj zapisa za sinhronizaciju
  processedRecords Int      @default(0)
  createdRecords  Int       @default(0)
  updatedRecords  Int       @default(0)
  skippedRecords  Int       @default(0)
  errorRecords    Int       @default(0)
  errorDetails    Json?     // Detalji grešaka
  userId          Int       // Ko je pokrenuo
  user            User      @relation(fields: [userId], references: [id])
  createdAt       DateTime  @default(now())
  
  syncDetails     VehicleSyncDetail[]
  
  @@map("vehicle_sync_logs")
}

model VehicleSyncDetail {
  id              Int       @id @default(autoincrement())
  syncLogId       Int
  syncLog         VehicleSyncLog @relation(fields: [syncLogId], references: [id], onDelete: Cascade)
  legacyId        Int
  action          String    // 'create' | 'update' | 'skip' | 'error'
  changes         Json?     // Promene koje su detektovane
  conflictFields  Json?     // Polja sa konfliktima
  resolution      String?   // 'auto' | 'manual' | 'pending'
  errorMessage    String?
  createdAt       DateTime  @default(now())
  
  @@map("vehicle_sync_details")
  @@index([syncLogId])
  @@index([legacyId])
}
```

### 2.2 Sync Service arhitektura

```typescript
// sync-vehicles.service.ts
class VehicleSyncService {
  // Konfiguracija
  private readonly BATCH_SIZE = 50;        // Broj vozila po batch-u
  private readonly DELAY_BETWEEN_BATCHES = 2000; // 2 sekunde pauze
  private readonly MAX_RETRIES = 3;
  
  // Glavna sync metoda
  async startSync(userId: number, syncType: 'full' | 'incremental') {
    // 1. Kreiraj sync log
    // 2. Pokreni background job (Bull queue)
    // 3. Vrati sync log ID za praćenje
  }
  
  // Background job handler
  async processSyncJob(syncLogId: number) {
    // 1. Učitaj sync log
    // 2. Konektuj se na legacy bazu
    // 3. Obradi u batch-ovima
    // 4. Update sync log status
  }
  
  // Batch processing
  async processBatch(vehicles: any[], syncLogId: number) {
    // 1. Za svako vozilo proveri da li postoji (po legacy_id)
    // 2. Uporedi podatke
    // 3. Kreiraj ili update
    // 4. Loguj akciju u sync_details
  }
  
  // Conflict detection
  detectConflicts(legacyVehicle: any, localVehicle: any) {
    // Vraća listu polja koja su različita
  }
  
  // Rollback funkcionalnost
  async rollbackSync(syncLogId: number) {
    // Vraća podatke na prethodno stanje koristeći sync_details
  }
}
```

## 3. UI/UX design

### 3.1 Lokacija u admin portalu

**Opcija A: Novi tab u postojećoj Administraciji vozila**
```
Administracija vozila
  ├── Tab 1: Lista vozila (postojeće)
  └── Tab 2: Sinhronizacija
```

**Opcija B: Nova meni stavka (preporučeno)**
```
Transport
  ├── Administracija vozila
  └── Sinhronizacija podataka
      ├── Vozila
      ├── Linije (budućnost)
      └── Stanice (budućnost)
```

### 3.2 UI komponente

```tsx
// Glavna stranica sinhronizacije
<VehicleSyncPage>
  // Status sekcija
  <SyncStatusCard>
    - Poslednja sinhronizacija: datum/vreme
    - Status: In progress / Completed
    - Statistika: 1243/1243 obrađeno
  </SyncStatusCard>
  
  // Kontrole
  <SyncControls>
    <Button>Pokreni punu sinhronizaciju</Button>
    <Button>Pokreni inkrementalnu</Button>
    <Button>Zaustavi</Button>
  </SyncControls>
  
  // Progress bar
  <Progress percent={75} status="active" />
  
  // Istorija sinhronizacija
  <SyncHistoryTable>
    - Datum/vreme
    - Tip
    - Korisnik
    - Status
    - Kreirano/Ažurirano/Preskočeno
    - Akcije (Detalji, Rollback)
  </SyncHistoryTable>
  
  // Modal za konflikte
  <ConflictResolutionModal>
    - Prikaz razlika između legacy i lokalne verzije
    - Opcije: Keep local / Use legacy / Manual merge
  </ConflictResolutionModal>
</VehicleSyncPage>
```

## 4. Strategije sinhronizacije

### 4.1 Puna sinhronizacija (Initial import)
1. Učitaj sve iz legacy baze (batch po batch)
2. Za svako vozilo:
   - Ako ne postoji → kreiraj
   - Ako postoji → uporedi i update ako treba
3. Loguj sve akcije

### 4.2 Inkrementalna sinhronizacija
1. Koristi `updated_at` ili `modified_date` iz legacy
2. Učitaj samo promenjene od poslednje sync
3. Primeni promene

### 4.3 Konflikt rezolucija

**Automatska rezolucija (default)**:
- Legacy ima prioritet za većinu polja
- Lokalne promene se čuvaju samo za specifična polja (npr. note)

**Polu-automatska**:
- Detektuj konflikte
- Prikaži korisniku
- Čekaj odluku

**Field-level prioriteti**:
```javascript
const FIELD_PRIORITIES = {
  // Legacy ima prioritet
  'registrationNumber': 'legacy',
  'technicalControlTo': 'legacy',
  'registrationValidTo': 'legacy',
  
  // Lokalno ima prioritet
  'note': 'local',
  'imageUrl': 'local',
  
  // Zahteva manual review
  'active': 'manual',
  'visible': 'manual'
};
```

## 5. Implementacioni koraci

### Faza 1: Osnovna infrastruktura
1. ✅ Kreirati Prisma modele za sync log
2. ✅ Kreirati sync service sa osnovnim metodama
3. ✅ Implementirati batch processing sa delay
4. ✅ Kreirati Bull queue za background jobs

### Faza 2: UI implementacija
1. ✅ Kreirati sync stranicu u admin portalu
2. ✅ Implementirati progress tracking
3. ✅ Kreirati istoriju sinhronizacija
4. ✅ Dodati start/stop kontrole

### Faza 3: Napredne funkcionalnosti
1. ⬜ Konflikt detekcija i rezolucija
2. ⬜ Rollback funkcionalnost
3. ⬜ Scheduled sync (cron jobs)
4. ⬜ Email notifikacije
5. ⬜ Webhook integracije

### Faza 4: Optimizacije
1. ⬜ Caching strategija
2. ⬜ Parallel processing (više worker-a)
3. ⬜ Delta sync (samo promenjeni podaci)
4. ⬜ Compression za velike dataset-e

## 6. Sigurnosni aspekti

- **Permisije**: Nova permisija `vehicles:sync`
- **Rate limiting**: Max 1 sync na 5 minuta
- **Audit log**: Sve akcije se loguju
- **Backup**: Pre svake sync napraviti backup
- **Monitoring**: Alert za failed sync

## 7. Monitoring i alerting

```typescript
// Metrike za praćenje
interface SyncMetrics {
  syncDuration: number;        // Trajanje u sekundama
  recordsPerSecond: number;    // Brzina procesiranja
  errorRate: number;           // Procenat grešaka
  conflictRate: number;        // Procenat konflikata
  memoryUsage: number;         // MB korišćene memorije
  dbConnections: number;       // Broj konekcija
}
```

## 8. Testing strategija

1. **Unit testovi**: Sync logic, conflict detection
2. **Integration testovi**: Database operations
3. **E2E testovi**: Full sync flow
4. **Load testovi**: Performance sa 10k+ records
5. **Chaos testovi**: Network failures, timeouts

## 9. Rollback strategija

```typescript
// Čuvamo snapshot pre svake sync
interface VehicleSnapshot {
  syncLogId: number;
  vehicleId: number;
  data: Json; // Kompletno stanje vozila pre promene
  createdAt: DateTime;
}

// Rollback proces
async rollbackSync(syncLogId: number) {
  // 1. Učitaj sve snapshot-e za taj sync
  // 2. Vrati podatke na prethodno stanje
  // 3. Označi sync kao "rolled_back"
  // 4. Kreiraj novi log za rollback akciju
}
```

## 10. Budući razvoj

- **Real-time sync**: WebSocket za instant updates
- **Bi-directional sync**: Promene iz našeg sistema → legacy
- **Multi-tenant**: Podrška za više legacy sistema
- **Smart conflict resolution**: ML za predviđanje ispravnih vrednosti
- **Data validation**: Automatska validacija podataka
- **Sync templates**: Predefinisane sync strategije

## 11. Dokumentacija za korisnike

### Korisničko uputstvo
1. Pristupite "Transport → Sinhronizacija podataka"
2. Kliknite "Pokreni sinhronizaciju"
3. Pratite progress bar
4. Pregledajte rezultate u istoriji

### FAQ
- **Q: Koliko često treba pokretati sync?**
  A: Preporučujemo dnevnu inkrementalnu sync

- **Q: Šta ako sync fail-uje?**
  A: Sistem automatski pokušava 3 puta, zatim šalje notifikaciju

- **Q: Da li mogu vratiti promene?**
  A: Da, rollback je dostupan do 30 dana

## 12. Estimacija

### MVP (Faza 1 & 2)
- **Backend**: 3-4 dana
- **Frontend**: 2-3 dana
- **Testing**: 2 dana
- **Total**: ~1.5 nedelje

### Full implementacija (sve faze)
- **Development**: 3-4 nedelje
- **Testing**: 1 nedelja
- **Documentation**: 3 dana
- **Total**: ~5 nedelja

## 13. Rizici i mitigacije

| Rizik | Verovatnoća | Impact | Mitigacija |
|-------|------------|--------|------------|
| Legacy baza timeout | Srednja | Visok | Batch processing, retry logic |
| Data corruption | Niska | Visok | Backup, validation, rollback |
| Performance degradation | Srednja | Srednji | Queue system, caching |
| Konflikti podataka | Visoka | Srednji | Clear resolution strategy |
| Network failures | Srednja | Srednji | Retry, resume capability |

## 14. Success criteria

- ✅ Sync 1000+ vozila bez grešaka
- ✅ Prosečno vreme sync < 5 minuta
- ✅ Error rate < 1%
- ✅ Conflict resolution < 5% manual
- ✅ Zero data loss
- ✅ Full audit trail