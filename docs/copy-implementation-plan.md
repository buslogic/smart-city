# 📋 COPY Implementacija za TimescaleDB - Detaljni Plan

## 🎯 Cilj
Implementirati COPY metodu za brži import GPS podataka u TimescaleDB kao alternativu postojećem batch INSERT pristupu.

## 📊 Očekivane Performanse
- **Batch INSERT (trenutno)**: 2,500 redova = ~200-500ms
- **COPY (novo)**: 10,000 redova = ~100-200ms
- **Poboljšanje**: 4-10x brže za velike količine podataka

## 🏗️ Arhitektura Rešenja

### Dual-Mode Sistem
```
┌─────────────────┐
│  Smart Slow     │
│  Sync Config    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│  Worker Pool    │────▶│  Odlučivanje │
│  Service        │     │  koje metode │
└────────┬────────┘     └──────────────┘
         │                      │
         ├──────────────────────┤
         ▼                      ▼
┌─────────────────┐     ┌──────────────┐
│  Batch INSERT   │     │     COPY     │
│  (postojeći)    │     │    (novo)    │
└─────────────────┘     └──────────────┘
         │                      │
         └──────────┬───────────┘
                    ▼
            ┌──────────────┐
            │ TimescaleDB  │
            └──────────────┘
```

## 📝 TODO Lista - Detaljan Breakdown

### FAZA 1: Backend Priprema (2-3 sata)

#### 1.1 Instalacija Biblioteka
```bash
cd /home/kocev/smart-city/apps/backend
npm install pg-copy-streams
npm install --save-dev @types/pg-copy-streams
```

#### 1.2 WorkerPoolConfig Interface Izmene
**Fajl**: `/apps/backend/src/gps-sync/legacy-sync-worker-pool.service.ts`

```typescript
interface WorkerPoolConfig {
  maxWorkers: number;
  workerTimeout: number;
  retryAttempts: number;
  // NOVO:
  insertMethod: 'batch' | 'copy' | 'auto';
  copyBatchSize: number;        // default: 10000
  useTempTable: boolean;         // default: true
  copyTimeout: number;           // default: 30000ms
  resourceLimits: {
    maxMemoryMB: number;
    maxCpuPercent: number;
  };
}
```

#### 1.3 Implementacija COPY Metode
**Lokacija**: Nova metoda u `legacy-sync-worker-pool.service.ts`

```typescript
private async insertWithCopy(
  batch: any[], 
  pool: Pool,
  vehicleId: number,
  garageNo: string
): Promise<void> {
  // Implementacija (detalji u fajlu)
}
```

**Ključni delovi**:
1. Import pg-copy-streams
2. Kreiranje temp tabele
3. COPY stream setup
4. CSV formatting
5. Transfer iz temp u glavnu tabelu
6. Error handling i rollback

#### 1.4 Modifikacija insertBatchToTimescale
**Promena postojeće metode da koristi odlučivanje**:
```typescript
private async insertBatchToTimescale(
  batch: any[], 
  pool: Pool,
  vehicleId: number,
  garageNo: string
): Promise<void> {
  const method = this.determineInsertMethod(batch.length);
  
  if (method === 'copy') {
    await this.insertWithCopy(batch, pool, vehicleId, garageNo);
  } else {
    await this.insertWithBatch(batch, pool, vehicleId, garageNo);
  }
}
```

### FAZA 2: Konfiguracija i Persistencija (1-2 sata)

#### 2.1 SystemSettings Podešavanja
**Novi ključevi**:
- `legacy_sync.insert_method` = 'batch' | 'copy' | 'auto'
- `legacy_sync.copy_batch_size` = 10000
- `legacy_sync.copy_use_temp_table` = true
- `legacy_sync.copy_timeout` = 30000

#### 2.2 Prisma Migracija
```bash
npx prisma migrate dev --name add_copy_settings
```

**SQL za seeding**:
```sql
INSERT INTO SystemSettings (key, value, type, category) VALUES
('legacy_sync.insert_method', 'batch', 'string', 'legacy_sync'),
('legacy_sync.copy_batch_size', '10000', 'number', 'legacy_sync'),
('legacy_sync.copy_use_temp_table', 'true', 'boolean', 'legacy_sync'),
('legacy_sync.copy_timeout', '30000', 'number', 'legacy_sync');
```

#### 2.3 LoadConfiguration Update
```typescript
case 'legacy_sync.insert_method':
  this.config.insertMethod = value as 'batch' | 'copy' | 'auto';
  break;
case 'legacy_sync.copy_batch_size':
  this.config.copyBatchSize = value as number;
  break;
// etc...
```

### FAZA 3: API Endpoints (1 sat)

#### 3.1 DTO Definicije
**Fajl**: `/apps/backend/src/gps-sync/dto/copy-config.dto.ts`

```typescript
export class CopyConfigDto {
  @IsEnum(['batch', 'copy', 'auto'])
  insertMethod: 'batch' | 'copy' | 'auto';

  @IsNumber()
  @Min(1000)
  @Max(50000)
  copyBatchSize: number;

  @IsBoolean()
  useTempTable: boolean;
}
```

#### 3.2 Controller Endpoints
**Fajl**: `/apps/backend/src/gps-sync/legacy-sync.controller.ts`

```typescript
@Get('config/copy')
async getCopyConfig(): Promise<CopyConfigDto>

@Patch('config/copy')
async updateCopyConfig(@Body() dto: CopyConfigDto): Promise<CopyConfigDto>
```

### FAZA 4: Frontend UI (2 sata)

#### 4.1 Smart Slow Sync Dashboard Izmene
**Fajl**: `/apps/admin-portal/src/pages/legacy-sync/SmartSlowSyncDashboard.tsx`

**Nova UI sekcija**:
```tsx
<Card title="Metoda Unosa Podataka" extra={<InfoCircleOutlined />}>
  <Radio.Group value={config.insertMethod} onChange={handleMethodChange}>
    <Radio.Button value="batch">
      <DatabaseOutlined /> Batch INSERT
      <div style={{ fontSize: '10px' }}>Sigurniji, detaljniji error handling</div>
    </Radio.Button>
    <Radio.Button value="copy">
      <RocketOutlined /> COPY
      <div style={{ fontSize: '10px' }}>4-10x brži za velike količine</div>
    </Radio.Button>
    <Radio.Button value="auto">
      <ThunderboltOutlined /> Automatski
      <div style={{ fontSize: '10px' }}>Sistem bira optimalnu metodu</div>
    </Radio.Button>
  </Radio.Group>
  
  {config.insertMethod === 'copy' && (
    <Form.Item label="COPY Batch Size">
      <InputNumber 
        value={config.copyBatchSize}
        min={1000}
        max={50000}
        step={1000}
      />
    </Form.Item>
  )}
</Card>
```

#### 4.2 API Service Izmene
**Fajl**: `/apps/admin-portal/src/services/legacySyncService.ts`

```typescript
async getCopyConfig(): Promise<CopyConfig> {
  const response = await api.get('/api/legacy-sync/config/copy');
  return response.data;
}

async updateCopyConfig(config: CopyConfig): Promise<void> {
  await api.patch('/api/legacy-sync/config/copy', config);
}
```

### FAZA 5: Testiranje (2-3 sata)

#### 5.1 Unit Testovi
- Test COPY metode sa malim skupom (100 redova)
- Test COPY metode sa velikim skupom (10,000 redova)
- Test error handling (neispravni podaci)
- Test rollback na grešku

#### 5.2 Integration Testovi
- Test prebacivanja između batch i COPY
- Test auto mode odlučivanja
- Test sa real GPS podacima

#### 5.3 Performance Testovi
```typescript
// Test scenario 1: Mali skup
await testPerformance(1000, 'batch');   // ~400ms
await testPerformance(1000, 'copy');    // ~300ms

// Test scenario 2: Srednji skup
await testPerformance(10000, 'batch');  // ~4s
await testPerformance(10000, 'copy');   // ~1s

// Test scenario 3: Veliki skup
await testPerformance(100000, 'batch'); // ~40s
await testPerformance(100000, 'copy');  // ~8s
```

## 🚨 Kritične Tačke za Pažnju

### 1. PostGIS Location Kolona
- **Rešeno**: Trigger automatski generiše location
- Ne treba WKT format
- Samo preskačemo location kolonu u COPY

### 2. ON CONFLICT Handling
- COPY ne podržava direktno ON CONFLICT
- Rešenje: Temp tabela + INSERT FROM SELECT

### 3. Error Handling
- Sa COPY gubimo granularnost
- Ceo batch fail-uje
- Logovanje je kritično

### 4. Memory Management
- COPY koristi manje memorije
- Ali stream mora biti pravilno zatvoren
- Pool connection management je kritičan

### 5. Rollback Strategija
```typescript
try {
  await client.query('BEGIN');
  // COPY operacije
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  // Fallback na batch metodu?
  if (this.config.fallbackToBatch) {
    await this.insertWithBatch(batch, pool);
  }
}
```

## 📈 Monitoring i Logovanje

### Metruje koje pratimo:
1. **Vreme izvršavanja** po metodi
2. **Broj uspešnih/neuspešnih** import-a
3. **Prosečna brzina** (redova/sekund)
4. **Memory usage** tokom COPY
5. **Fallback events** (kada COPY fail-uje)

### Log Format:
```
[COPY] Starting import: 10000 rows, vehicle_id: 460
[COPY] Temp table created: gps_data_temp_460_1234567890
[COPY] Streaming data... 
[COPY] Stream complete: 10000 rows in 1.2s (8333 rows/s)
[COPY] Transferring to main table...
[COPY] ✅ Complete: 10000 rows imported in 1.5s total
```

## 🔄 Rollback Plan

Ako COPY implementacija ima probleme:
1. Config flag da se vrati na batch: `legacy_sync.force_batch_mode`
2. Svi COPY pozivi imaju fallback na batch metodu
3. UI dugme za "Force Batch Mode" u dashboard-u

## 📅 Vremenska Procena

| Faza | Vreme | Prioritet |
|------|-------|-----------|
| Backend implementacija | 3-4 sata | Visok |
| Konfiguracija | 1-2 sata | Visok |
| API endpoints | 1 sat | Srednji |
| Frontend UI | 2 sata | Srednji |
| Testiranje | 2-3 sata | Visok |
| **UKUPNO** | **9-12 sati** | - |

## 🎯 Definition of Done

- [ ] pg-copy-streams instaliran i konfigurisan
- [ ] COPY metoda implementirana sa temp table strategijom
- [ ] Dual-mode sistem funkcioniše (batch/copy/auto)
- [ ] Konfiguracija se čuva u SystemSettings
- [ ] UI kontrole rade u Smart Slow Sync Dashboard
- [ ] Error handling pokriva sve scenarije
- [ ] Performance je 4x+ bolja za 10K+ redova
- [ ] Dokumentacija ažurirana
- [ ] Testovi prolaze

## 🔗 Reference

1. [pg-copy-streams dokumentacija](https://github.com/brianc/node-postgres/tree/master/packages/pg-copy-streams)
2. [PostgreSQL COPY dokumentacija](https://www.postgresql.org/docs/current/sql-copy.html)
3. [TimescaleDB best practices](https://docs.timescale.com/timescaledb/latest/how-to-guides/write-data/bulk-insert/)

---
*Ovaj dokument služi kao referenca za implementaciju COPY funkcionalnosti. Ažuriraj ga tokom razvoja.*