# GPS Data Processing Pipeline - Smart City Platform

## 📅 Dokument kreiran: 31.08.2025
## 🎯 Povezano sa: GPS_DATA_MIGRATION_ARCHITECTURE.md

## 📋 Pregled Sistema

Ovaj dokument opisuje kako Smart City backend prima i obrađuje GPS podatke sa legacy Teltonika servera (79.101.48.11) korišćenjem minimalnih izmena na legacy sistemu.

## 🔄 End-to-End Flow

```
Legacy PHP Server (79.101.48.11)
         ↓
    HTTP POST (async)
         ↓
Smart City API Gateway
         ↓
    Validation Layer
         ↓
    Redis Queue (Bull)
         ↓
    Worker Processing
         ↓
    TimescaleDB
         ↓
   Distribution Layer
    /     |     \
WebSocket  Alerts  Analytics
```

## 1️⃣ Prijem Podataka

### Endpoint Specifikacija
- **URL**: `https://adminapi.smart-city.rs/gps-ingest/teltonika`
- **Method**: POST
- **Authentication**: API Key u header-u (`X-API-Key`)
- **Rate Limit**: 100 requests/second po API key
- **Timeout**: 5 sekundi

### Struktura podataka koja se prima
```json
{
  "imei": "352093089553839",
  "garage_no": "P93597",
  "timestamp": "2025-08-31 20:45:30",
  "lat": 44.8125,
  "lng": 20.4612,
  "speed": 45,
  "course": 180,
  "altitude": 117,
  "io_data": {
    "21": 12450,      // External voltage (mV)
    "66": 13800,      // External power voltage (mV)
    "239": 1,         // Ignition status
    "16": 145230,     // Total odometer (km)
    "179": 12345678   // Driver card serial
  }
}
```

### API Key Management
- Svaki legacy server ima jedinstveni API key
- Keys se čuvaju u Redis sa TTL
- Rotation svakih 90 dana
- Rate limiting po key-u

## 2️⃣ Queue Sistem (Bull/Redis)

### Queue Konfiguracija
```yaml
Queues:
  - gps-high-priority    # Vozila u alarmu, hitni slučajevi
  - gps-normal           # Regularni GPS podaci
  - gps-batch            # Batch import istorijskih podataka
  - gps-dead-letter      # Failed messages nakon 3 retry-ja
```

### Queue Karakteristike
- **Capacity**: 100,000 messages
- **Processing rate**: 1,000 msg/sec
- **Retry policy**: 3 attempts sa exponential backoff
- **TTL**: 24h za neprocesirane poruke
- **Persistence**: Redis AOF za crash recovery

### Worker Pool
- **Broj worker-a**: 10 (auto-scaling 5-20)
- **Concurrency**: 100 jobs per worker
- **Memory limit**: 512MB per worker
- **Restart policy**: Nakon 1000 jobs ili 1h

## 3️⃣ Processing Pipeline

### Stage 1: Enrichment
Dodavanje dodatnih informacija pre čuvanja:

| Polje | Izvor | Opis |
|-------|-------|------|
| vehicle_id | vehicles tabela | Mapiranje garage_no → ID |
| line_id | current_assignments | Trenutna linija |
| driver_id | io_data[179] → drivers | Vozač preko kartice |
| zone_id | PostGIS query | Trenutna zona |
| station_id | Najbliža stanica | U radijusu 50m |
| city_district | Geocoding | Opština/kvart |

### Stage 2: Validation & Filtering

#### Validation Rules
- **Koordinate**: Lat: 42.0-46.0, Lng: 19.0-23.0 (Srbija)
- **Brzina**: 0-200 km/h (bus max)
- **Timestamp**: Ne stariji od 24h, ne u budućnosti
- **IMEI**: Mora postojati u whitelist
- **Duplicate check**: Isti timestamp + vehicle = skip

#### Filtering Logic
```
IF speed > 150 km/h → Mark as suspicious
IF distance_from_last > 1km AND time_diff < 10sec → Invalid jump
IF altitude < 0 OR altitude > 2000 → Invalid altitude
IF satellites < 4 → Low quality signal (flag it)
```

### Stage 3: Calculations

#### Real-time kalkulacije
1. **Rastojanje između tačaka**
   - PostGIS: `ST_Distance(prev_point, current_point)`
   - Dodaje se na daily_mileage counter

2. **Detekcija zastoja**
   - Ako speed < 5 km/h duže od 2 min → STOP event
   - Ako na stanici → STATION_STOP
   - Inače → TRAFFIC_JAM

3. **Aggressive driving**
   - Acceleration = (speed_current - speed_prev) / time_diff
   - Ako > 2.5 m/s² → HARSH_ACCELERATION
   - Ako < -4.0 m/s² → HARSH_BRAKING

4. **Geofencing eventi**
   - Ulazak/izlazak iz depot-a
   - Prolazak kroz kontrolne tačke
   - Skretanje sa rute

## 4️⃣ Storage Strategy

### TimescaleDB Schema

#### Glavna tabela: `gps_data`
```sql
CREATE TABLE gps_data (
    time TIMESTAMPTZ NOT NULL,
    vehicle_id INTEGER NOT NULL,
    garage_no VARCHAR(20),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    location GEOMETRY(Point, 4326),
    speed NUMERIC(5,2),
    course SMALLINT,
    altitude SMALLINT,
    
    -- IO data
    battery_voltage INTEGER,
    external_voltage INTEGER,
    ignition BOOLEAN,
    odometer INTEGER,
    driver_card_id BIGINT,
    
    -- Enriched data
    line_id INTEGER,
    zone_id INTEGER,
    nearest_station_id INTEGER,
    distance_from_station NUMERIC(6,2),
    
    -- Quality metrics
    satellites SMALLINT,
    hdop NUMERIC(3,1),
    is_valid BOOLEAN DEFAULT true,
    
    PRIMARY KEY (vehicle_id, time)
);

-- Convert to hypertable
SELECT create_hypertable('gps_data', 'time', 
    chunk_time_interval => INTERVAL '1 day');
```

#### Continuous Aggregates
```sql
-- Hourly aggregates
CREATE MATERIALIZED VIEW gps_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', time) AS hour,
    vehicle_id,
    AVG(speed) as avg_speed,
    MAX(speed) as max_speed,
    COUNT(*) as data_points,
    SUM(ST_Distance(location, LAG(location) OVER (ORDER BY time))) as distance_km
FROM gps_data
GROUP BY hour, vehicle_id
WITH NO DATA;
```

### Redis Cache Structure
```
Keys:
- vehicle:current:{id}      → Latest position (TTL: 24h)
- vehicle:status:{id}       → Online/offline status (TTL: 5min)
- vehicle:track:{id}        → Last 100 points (TTL: 1h)
- stats:daily:{date}        → Daily statistics (TTL: 7d)
- alerts:active             → Active alerts set
```

### Data Retention Policy
- **Raw GPS data**: 2 godine
- **Compressed (> 7 dana)**: Automatska kompresija
- **Aggregates**: Neograničeno
- **Backup**: Daily export to S3

## 5️⃣ Real-time Distribution

### WebSocket Events

#### Event Types
```javascript
// Vehicle position update
{
  type: 'VEHICLE_POSITION',
  vehicleId: 123,
  data: { lat, lng, speed, timestamp }
}

// Alert notification
{
  type: 'VEHICLE_ALERT',
  vehicleId: 123,
  alert: 'SPEEDING',
  data: { speed: 95, limit: 80, location }
}

// Zone event
{
  type: 'ZONE_EVENT',
  vehicleId: 123,
  event: 'ENTERED',
  zone: { id: 5, name: 'Depot Karaburma' }
}
```

### Broadcasting Rules
- **Throttling**: Max 10 updates/sec per vehicle
- **Filtering**: Based on user permissions
- **Compression**: gzip for large batches
- **Fallback**: Long polling if WebSocket fails

### Alert Triggers

| Trigger | Condition | Action |
|---------|-----------|--------|
| Speeding | speed > limit + 10% | SMS to dispatcher |
| Long stop | stopped > 15min off-station | Push notification |
| Route deviation | distance from route > 500m | Email to manager |
| Low battery | voltage < 11.5V | Maintenance ticket |
| No signal | No data > 5min | Mark as offline |
| Geofence violation | Unauthorized zone entry | Security alert |

## 6️⃣ Agregacije i Analitika

### Real-time Metrics (Redis)
- Vozila online/offline
- Prosečna brzina flote
- Trenutni alarmi
- Vozila po zonama

### Hourly Aggregations (TimescaleDB)
- Pređena kilometraža po vozilu
- Prosečna brzina po liniji
- Broj stop eventi
- Fuel consumption estimates

### Daily Batch Jobs (02:00 AM)
```
1. Generate daily reports
   - Mileage report
   - Driver performance
   - Incident summary
   
2. Data quality check
   - Missing data periods
   - Invalid GPS points %
   - Duplicate records
   
3. ML model update
   - Route prediction model
   - Maintenance prediction
   - Traffic pattern analysis
   
4. Cleanup tasks
   - Archive old alerts
   - Compress yesterday's data
   - Update statistics cache
```

## 🚀 Performance Optimizacije

### Database
- **Connection pooling**: PgBouncer (100 connections)
- **Batch inserts**: 500-1000 records per transaction
- **Prepared statements**: Za česte upite
- **Partitioning**: Po danu za GPS tabelu
- **Indexes**: Na (vehicle_id, time), (time), location GIST

### Application
- **Worker pooling**: 10 workers sa queue
- **Caching**: Redis za česte upite
- **Async processing**: Non-blocking I/O
- **Circuit breaker**: Za external services
- **Rate limiting**: Per API key i global

### Network
- **Keep-alive**: Za persistent connections
- **Compression**: gzip za API responses
- **CDN**: Za static assets
- **Load balancing**: Round-robin sa health checks

## 📊 Monitoring & Observability

### Key Metrics
```yaml
Application Metrics:
  - gps_messages_received_total
  - gps_messages_processed_total
  - gps_processing_duration_seconds
  - gps_validation_errors_total
  - gps_queue_depth
  - gps_worker_utilization_percent

Database Metrics:
  - timescale_compression_ratio
  - timescale_chunk_count
  - query_duration_p95
  - connection_pool_usage
  - deadlock_count

Business Metrics:
  - vehicles_online_count
  - daily_mileage_total
  - active_alerts_count
  - data_freshness_seconds
```

### Alert Rules
| Alert | Condition | Severity |
|-------|-----------|----------|
| High queue depth | > 10,000 messages | Warning |
| Processing lag | > 5 minutes | Critical |
| Worker crash | Restart > 3 in 10min | Critical |
| Database connection pool | > 80% used | Warning |
| API error rate | > 1% | Warning |
| No data from vehicle | > 10 minutes | Info |

### Dashboards (Grafana)
1. **Operations Dashboard**
   - Message throughput
   - Queue depth
   - Processing latency
   - Error rates

2. **Fleet Dashboard**
   - Vehicle positions map
   - Speed distribution
   - Online/offline status
   - Active alerts

3. **Performance Dashboard**
   - API response times
   - Database query performance
   - Worker utilization
   - Cache hit rates

## 🔧 Troubleshooting Guide

### Common Issues

#### 1. High Queue Depth
```bash
# Check queue status
redis-cli LLEN bull:gps-normal:wait

# Scale workers
kubectl scale deployment gps-workers --replicas=20

# Check for slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_time DESC;
```

#### 2. Missing GPS Data
```bash
# Check API logs
tail -f /var/log/gps-ingest.log | grep ERROR

# Verify network connectivity
curl -X POST https://adminapi.smart-city.rs/gps-ingest/health

# Check TimescaleDB chunks
SELECT show_chunks('gps_data');
```

#### 3. WebSocket Connection Issues
```bash
# Check active connections
netstat -an | grep :3010 | wc -l

# Restart WebSocket service
systemctl restart smart-city-websocket

# Check Redis pub/sub
redis-cli PUBSUB CHANNELS
```

## 🔐 Security Considerations

1. **API Authentication**
   - API keys rotated every 90 days
   - IP whitelisting for legacy servers
   - Rate limiting per key

2. **Data Encryption**
   - TLS 1.3 for all API calls
   - Encryption at rest for TimescaleDB
   - Redis AUTH enabled

3. **Access Control**
   - Row-level security in database
   - Permission-based WebSocket filtering
   - Audit logs for all access

4. **Data Privacy**
   - Driver data anonymization
   - GDPR compliance for location data
   - Data retention policies

## 📚 Dependencies

### NPM Packages
- `@nestjs/bull` - Queue management
- `bull` - Redis-based queue
- `@nestjs/websockets` - WebSocket support
- `socket.io` - WebSocket implementation
- `pg` - PostgreSQL client
- `ioredis` - Redis client
- `class-validator` - DTO validation
- `@nestjs/throttler` - Rate limiting

### Infrastructure
- TimescaleDB 2.x with PostGIS 3.x
- Redis 7.x
- Node.js 18.x LTS
- PostgreSQL 14.x
- Nginx (reverse proxy)

## 🚦 Implementation Checklist

### Phase 1: Basic Reception (Week 1)
- [ ] Create API endpoint
- [ ] Implement API key validation
- [ ] Setup Redis queue
- [ ] Basic validation logic
- [ ] Store to TimescaleDB

### Phase 2: Processing (Week 2)
- [ ] Enrichment pipeline
- [ ] Calculation engine
- [ ] Continuous aggregates
- [ ] Alert system
- [ ] WebSocket broadcasting

### Phase 3: Optimization (Week 3)
- [ ] Performance tuning
- [ ] Caching layer
- [ ] Batch processing
- [ ] Monitoring setup
- [ ] Load testing

### Phase 4: Production (Week 4)
- [ ] Security audit
- [ ] Documentation
- [ ] Deployment scripts
- [ ] Backup procedures
- [ ] Go-live

## 📞 Support Contacts

- **DevOps Team**: devops@smart-city.rs
- **Database Admin**: dba@smart-city.rs
- **On-call Engineer**: +381 64 XXX XXXX
- **TimescaleDB Support**: support@timescale.com

---
*Dokument se ažurira kontinuirano tokom implementacije i optimizacije sistema.*