# Smart Slow Sync - Arhitektura i Plan Implementacije

## 📋 Pregled Sistema

Smart Slow Sync je automatizovan sistem za postepenu sinhronizaciju GPS podataka koji radi u pozadini tokom perioda niskog opterećenja servera (noćni sati).

## 🎯 Ciljevi

1. **Sinhronizacija 1,250 vozila** za period od 4 meseca
2. **Bez opterećenja servera** - radi noću, pauzira danju
3. **Automatski cleanup** - održava bazu čistom
4. **Self-healing** - automatski recovery od grešaka
5. **Monitoring u realnom vremenu** - praćenje napretka

## 🏗️ Arhitektura

### Komponente Sistema

```
┌─────────────────────────────────────────┐
│          Smart Slow Sync Service         │
├─────────────────────────────────────────┤
│  • Scheduler (CRON)                      │
│  • Queue Manager                         │
│  • Worker Pool Coordinator               │
│  • Health Monitor                        │
│  • Cleanup Manager                       │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────┐       ┌──────────────┐
│ Worker Pool  │       │   Database   │
│              │       │              │
│ • Worker 1   │       │ • MySQL      │
│ • Worker 2   │       │ • TimescaleDB│
└──────────────┘       └──────────────┘
```

## 📊 Parametri Sistema

### Optimalni Setup za 1,250 vozila

```typescript
const OPTIMAL_CONFIG = {
  // Batch parametri
  vehiclesPerBatch: 10,        // 10 vozila po batch-u
  workersPerBatch: 2,          // 2 worker-a istovremeno
  batchDelayMinutes: 30,       // 30 min pauza između
  
  // Vremenski okvir
  nightHoursStart: 22,         // Pokreni posle 22h
  nightHoursEnd: 6,            // Zaustavi pre 6h (8 sati rada)
  maxDailyBatches: 10,         // Max 10 batch-ova dnevno
  
  // Period sinhronizacije
  syncDaysBack: 120,           // 4 meseca unazad
  
  // Maintenance
  autoCleanup: true,
  compressAfterBatches: 5,     // Kompresuj svakih 5 batch-ova
  vacuumAfterBatches: 20,      // VACUUM svakih 20 batch-ova
};
```

### Kalkulacije

- **Batch-ovi ukupno**: 1,250 / 10 = 125 batch-ova
- **Vreme po batch-u**: ~15 min procesiranje + 30 min pauza = 45 min
- **Dnevno**: 10 batch-ova × 45 min = 7.5 sati (fit u 8h noćni period)
- **Ukupno dana**: 125 / 10 = **12.5 dana**

### Očekivani podaci

- **Po vozilu**: ~2.5M GPS tačaka (4 meseca)
- **Ukupno**: 1,250 × 2.5M = **3.125 milijardi tačaka**
- **Disk prostor**: ~500GB-1TB nakon kompresije

## 🔍 Monitoring Points

### 1. Pre svakog batch-a proveriti:

```sql
-- Database connections
SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'smartcity_gps';

-- Disk space
SELECT pg_size_pretty(pg_database_size('smartcity_gps'));

-- Table size
SELECT pg_size_pretty(pg_total_relation_size('gps_data'));

-- Active queries
SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active';
```

### 2. Tokom batch-a pratiti:

- CPU usage: < 70%
- Memory: < 80%
- Network bandwidth
- Worker status
- Error rate

### 3. Posle batch-a:

- Broj procesiranih tačaka
- Trajanje
- Cleanup status
- Compression ratio

## 🧹 Cleanup Strategija

### Nivoi cleanup-a:

1. **Posle svakog batch-a** (brzo):
   - Obriši temp fajlove
   - Clear expired sessions
   - ANALYZE tabele

2. **Svakih 5 batch-ova** (srednje):
   - Compress old chunks
   - Refresh continuous aggregates
   - Clean old logs

3. **Svakih 20 batch-ova** (temeljno):
   - VACUUM ANALYZE
   - Reindex if needed
   - Archive old data

## ⚠️ Error Handling

### Retry strategija:

```typescript
interface RetryPolicy {
  maxRetries: 3,
  retryDelay: 5000,     // 5 sekundi
  backoffMultiplier: 2, // Exponential backoff
  
  recoverableErrors: [
    'ECONNREFUSED',     // Connection refused
    'ETIMEDOUT',        // Timeout
    'ENOTFOUND',        // DNS issue
  ],
  
  fatalErrors: [
    'ENOSPC',          // No disk space
    'ENOMEM',          // Out of memory
    'EACCES',          // Permission denied
  ]
}
```

### Recovery akcije:

1. **Connection lost**: Čekaj 30s, pokušaj ponovo
2. **Disk full**: Pauziraj, pošalji alert, čekaj cleanup
3. **High load**: Smanji broj worker-a
4. **Repeated failures**: Skip vozilo, nastavi sa sledećim

## 📱 UI Komponente

### Dashboard elementi:

```typescript
interface SlowSyncDashboard {
  // Progress overview
  progressBar: {
    total: 1250,
    completed: 125,
    percentage: 10,
    estimatedCompletion: Date
  },
  
  // Current batch
  currentBatch: {
    number: 13,
    vehicles: ['P93580', 'P93581', ...],
    startTime: Date,
    progress: 45,
    workers: [
      { id: 1, vehicle: 'P93580', status: 'importing' },
      { id: 2, vehicle: 'P93581', status: 'exporting' }
    ]
  },
  
  // Statistics
  stats: {
    totalPointsProcessed: 312500000,
    averageTimePerBatch: 45, // minutes
    successRate: 98.5,
    diskSpaceUsed: '125GB',
    compressionRatio: 4.2
  },
  
  // Controls
  controls: {
    pause: boolean,
    resume: boolean,
    stop: boolean,
    configure: boolean
  }
}
```

## 🔄 Rollback Plan

### Checkpoint sistem:

```sql
-- Pre svakog batch-a
CREATE TABLE sync_checkpoints (
  id SERIAL PRIMARY KEY,
  batch_number INT,
  vehicles_processed INT[],
  last_processed_time TIMESTAMP,
  total_points BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Rollback procedura:

1. Identifikuj poslednji dobar checkpoint
2. Obriši podatke posle tog checkpoint-a
3. Resetuj queue na taj point
4. Nastavi od tog batch-a

## 📈 Optimizacija za različite scenarije

### Scenario 1: Brza sinhronizacija (3-5 dana)
```typescript
{
  vehiclesPerBatch: 30,
  workersPerBatch: 6,
  batchDelayMinutes: 15,
  nightHoursStart: 20,
  nightHoursEnd: 8,     // 12 sati rada
  maxDailyBatches: 30
}
```

### Scenario 2: Balansirana (7-10 dana)
```typescript
{
  vehiclesPerBatch: 15,
  workersPerBatch: 3,
  batchDelayMinutes: 20,
  nightHoursStart: 22,
  nightHoursEnd: 6,
  maxDailyBatches: 15
}
```

### Scenario 3: Konzervativna (12-15 dana)
```typescript
{
  vehiclesPerBatch: 10,
  workersPerBatch: 2,
  batchDelayMinutes: 30,
  nightHoursStart: 23,
  nightHoursEnd: 5,
  maxDailyBatches: 10
}
```

## 🚀 Implementacioni koraci

1. **Faza 1**: Osnovni servis
   - [ ] SmartSlowSyncService
   - [ ] Queue management
   - [ ] Basic scheduler

2. **Faza 2**: Monitoring
   - [ ] Health checks
   - [ ] Progress tracking
   - [ ] Error handling

3. **Faza 3**: Cleanup
   - [ ] Auto cleanup
   - [ ] Compression
   - [ ] Maintenance tasks

4. **Faza 4**: UI
   - [ ] Dashboard komponenta
   - [ ] Real-time updates
   - [ ] Controls

5. **Faza 5**: Testing
   - [ ] Test sa 10 vozila
   - [ ] Test sa 50 vozila
   - [ ] Full test

## 📝 Dodatne napomene

- Početi sa manjim batch-ovima i postepeno povećavati
- Monitoring je kritičan - bolje prekinuti nego oštetiti podatke
- Cleanup je obavezan - inače će disk biti pun
- Dokumentovati svaku grešku i rešenje
- Imati backup plan za svaki scenario

## 🔐 Sigurnosni aspekti

- SSH ključevi moraju biti secured
- Database credentials u environment variables
- Audit log za sve operacije
- Rate limiting na API endpoints
- Encryption za sensitive data

## 📊 Očekivani rezultati

- **Trajanje**: 12-15 dana
- **Uspešnost**: > 98%
- **Downtime**: 0 (radi noću)
- **Manual intervention**: < 1h ukupno
- **Disk usage**: Kontrolisan (sa cleanup-om)