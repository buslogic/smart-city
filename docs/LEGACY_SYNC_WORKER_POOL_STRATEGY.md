# 🚀 Legacy Sync Worker Pool Strategija

## 📌 Executive Summary
Implementacija Worker Pool pattern-a za Legacy GPS Sync može doneti **10x poboljšanje performansi** omogućavajući paralelnu sinhronizaciju više vozila istovremeno.

## 🎯 Ciljevi
1. **Paralelizacija** - sinhronizvati više vozila istovremeno
2. **Skalabilnost** - dinamički broj worker-a prema opterećenju
3. **Resilience** - nezavisno izvršavanje, greška jednog ne prekida ostale
4. **Monitoring** - real-time praćenje svakog worker-a

## 📊 Trenutno stanje vs Željeno stanje

### Trenutno (Sekvencijalno)
```
Vozilo1 [====10min====] 
        Vozilo2 [====8min====]
                Vozilo3 [====12min====]
Ukupno: 30 minuta
```

### Željeno (Worker Pool)
```
Worker1: Vozilo1 [====10min====]
Worker2: Vozilo2 [====8min====]
Worker3: Vozilo3 [====12min====]
Ukupno: 12 minuta (najduže vozilo)
```

## 🏗️ Arhitektura rešenja

### 1. Worker Pool Manager
```typescript
interface WorkerPoolConfig {
  maxWorkers: number;        // Default: 3
  workerTimeout: number;     // Default: 600000ms (10min)
  retryAttempts: number;     // Default: 2
  resourceLimits?: {
    maxMemoryMB: number;     // Limit memorije po worker-u
    maxCpuPercent: number;   // CPU limit
  };
}
```

### 2. Worker implementacija
```typescript
class LegacySyncWorker {
  private workerId: number;
  private vehicle: Vehicle;
  private status: 'idle' | 'exporting' | 'transferring' | 'importing' | 'completed' | 'failed';
  
  async execute(): Promise<WorkerResult> {
    // 1. SSH Export (mysqldump)
    // 2. SCP Transfer
    // 3. TimescaleDB Import
    // 4. Cleanup
  }
}
```

### 3. Resource Management
- **SSH Connection Pool** - održava postojeće SSH konekcije
- **Concurrent Transfers** - limitiran broj istovremenih SCP transfer-a
- **Database Connections** - pooling za TimescaleDB

## 🔧 Implementacijski koraci

### Faza 1: Priprema (1-2 dana)
1. ✅ Kreirati `WorkerPoolManager` klasu
2. ✅ Implementirati `LegacySyncWorker` klasu  
3. ✅ Dodati konfiguraciju u SystemSettings

### Faza 2: Core implementacija (2-3 dana)
1. ✅ Refaktorisati `runSyncProcess` da koristi Worker Pool
2. ✅ Implementirati SSH connection pooling
3. ✅ Dodati resource monitoring

### Faza 3: Optimizacije (1-2 dana)
1. ✅ Implementirati adaptive worker scaling
2. ✅ Dodati priority queue za vozila
3. ✅ Optimizovati transfer strategiju

### Faza 4: Monitoring & UI (1 dan)
1. ✅ Real-time progress po worker-u
2. ✅ Worker status dashboard
3. ✅ Performance metriku

## 📈 Performance targets

| Metrika | Trenutno | Cilj | Poboljšanje |
|---------|----------|------|-------------|
| Vozila/h | 6 | 18-24 | 3-4x |
| CPU usage | 15% | 60% | Bolje iskorišćenje |
| Transfer speed | Sequential | Parallel | 3x |
| Error recovery | Manual | Automatic | ♾️ |

## 🛡️ Error handling strategija

### Worker-level
- Retry mehanizam sa exponential backoff
- Nezavisno logovanje po worker-u
- Graceful degradation

### Pool-level
- Circuit breaker za SSH konekcije
- Automatsko skaliranje pri greškama
- Health check monitoring

## 📝 Konfiguracija (SystemSettings)

```sql
-- Worker Pool podešavanja
INSERT INTO system_settings (key, value, type, category) VALUES
('legacy_sync.worker_pool.enabled', 'true', 'boolean', 'legacy_sync'),
('legacy_sync.worker_pool.max_workers', '3', 'number', 'legacy_sync'),
('legacy_sync.worker_pool.worker_timeout_ms', '600000', 'number', 'legacy_sync'),
('legacy_sync.ssh.connection_pool_size', '5', 'number', 'legacy_sync'),
('legacy_sync.transfer.concurrent_limit', '3', 'number', 'legacy_sync');
```

## 🎯 Success Criteria

1. **Performance**: 3x brža sinhronizacija
2. **Reliability**: 99% uspešnih sinhronizacija
3. **Scalability**: Podrška za 5+ simultanih worker-a
4. **Monitoring**: Real-time visibility svih worker-a

## 🚦 Rollout plan

1. **Test environment** - validacija sa 2 vozila
2. **Pilot** - 3 vozila sa monitoring-om
3. **Gradual rollout** - povećanje worker-a postupno
4. **Full deployment** - sva vozila sa auto-scaling

## ⚠️ Rizici i mitigacije

| Rizik | Verovatnoća | Impact | Mitigacija |
|-------|-------------|---------|------------|
| SSH connection limit | Medium | High | Connection pooling |
| Legacy server overload | Low | High | Rate limiting |
| Memory exhaustion | Low | Medium | Resource limits |
| Network interruptions | Medium | Low | Retry mechanism |

## 📊 Monitoring KPI

- Worker utilization rate
- Average sync time per vehicle
- Error rate per worker
- SSH connection pool health
- Transfer throughput (MB/s)
- Database insertion rate

## 🔄 Kontinuirana poboljšanja

1. **ML-based worker scaling** - predviđanje opterećenja
2. **Intelligent scheduling** - prioritizacija vozila
3. **Delta sync** - samo promene umesto full sync
4. **Compression optimization** - bolje kompresije algoritme

---

*Dokument kreiran: 2025-09-05*
*Verzija: 1.0*
*Autor: Smart City Development Team*