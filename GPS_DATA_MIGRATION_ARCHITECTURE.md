# GPS Data Migration Architecture - Smart City Platform

## 📅 Dokument kreiran: 31.08.2025
## 📍 Legacy serveri: 79.101.48.10, 79.101.48.11 (BGNaplata GSP)

## 🎯 Cilj
Migracija GPS podataka sa legacy PHP/MySQL sistema na modernu Event-Driven arhitekturu sa TimescaleDB.

## 📐 Optimalna Arhitektura

```
GPS Uređaji (Teltonika)
    ↓
[TCP Multiplexer/Load Balancer] (novi servis)
    ├→ [Message Queue (RabbitMQ/Kafka)]
    │       ├→ Smart City Consumer → TimescaleDB
    │       ├→ Legacy Consumer → MySQL (postojeći)
    │       └→ Analytics Consumer → Real-time processing
    └→ [Backup Raw Storage (S3/MinIO)]
```

## 🔧 Komponente Sistema

### 1. TCP Multiplexer Service (Go/Rust)
Visoko-performantni TCP server koji prima GPS podatke i distribuira ih.

```go
// Primer implementacije u Go
type GPSMultiplexer struct {
    listeners []net.Listener
    queue     MessageQueue
    rawStore  ObjectStorage
}

func (m *GPSMultiplexer) HandleConnection(conn net.Conn) {
    data := m.parseTelonika(conn)
    
    // 1. Sačuvaj raw podatke (replay capability)
    m.rawStore.Save(data.Raw)
    
    // 2. Pošalji na queue
    m.queue.Publish("gps.teltonika", data)
    
    // 3. Odgovori uređaju
    conn.Write(acknowledgment)
}
```

### 2. Message Queue (RabbitMQ sa persistence)
Garantuje isporuku poruka i omogućava horizontalno skaliranje.

```yaml
# docker-compose.yml
rabbitmq:
  image: rabbitmq:3-management
  volumes:
    - rabbitmq_data:/var/lib/rabbitmq
  environment:
    RABBITMQ_DEFAULT_VHOST: gps
    RABBITMQ_QUEUE_MASTER_LOCATOR: min-masters
  ports:
    - "5672:5672"
    - "15672:15672"
```

### 3. Smart City Consumer (Node.js/NestJS)
Novi consumer koji procesira podatke za Smart City platformu.

```typescript
@Injectable()
export class TeltonikaConsumer {
  @RabbitSubscribe({
    exchange: 'gps',
    routingKey: 'teltonika.*',
    queue: 'smartcity-gps-queue',
  })
  async handleGPSData(data: TeltonikaMessage) {
    // Validacija
    await this.validator.validate(data);
    
    // Transform
    const gpsData = this.transformer.toGPSData(data);
    
    // Batch insert u TimescaleDB
    await this.timescale.batchInsert(gpsData);
    
    // Real-time broadcast
    this.websocket.broadcast('gps.update', gpsData);
  }
}
```

### 4. Legacy Consumer (PHP)
Održava postojeći sistem tokom tranzicije.

```php
// Isti kod kao trenutni util_teltonika.php
class LegacyConsumer {
    public function consume($message) {
        $this->saveToMySQL($message);
        $this->updateCurrentTable($message);
    }
}
```

## 🛡️ Sigurnosne Mere

### 1. TLS Enkripcija
```nginx
stream {
    upstream gps_backend {
        server 127.0.0.1:12060 max_fails=3 fail_timeout=30s;
        server 127.0.0.1:12061 backup;
    }
    
    server {
        listen 443 ssl;
        ssl_certificate /etc/ssl/gps.crt;
        ssl_certificate_key /etc/ssl/gps.key;
        proxy_pass gps_backend;
    }
}
```

### 2. Dodatne mere
- Rate limiting i DDoS zaštita
- IMEI whitelist autentifikacija
- Data encryption at rest
- API key autentifikacija za sve servise

## 📊 Monitoring Stack

```yaml
# Prometheus metrике
metrics:
  - gps_messages_received_total
  - gps_messages_processed_total
  - gps_processing_duration_seconds
  - gps_queue_depth
  - gps_device_connections_active
  - gps_validation_errors_total
  - gps_database_write_duration_seconds
```

### Grafana Dashboard
- Real-time GPS throughput
- Device connection status
- Queue depth monitoring
- Error rate tracking
- Geographic distribution heatmap

## 🔄 Plan Migracije

### Faza 1: Parallel Run (2 nedelje)
- Novi sistem prima kopiju podataka
- Legacy sistem ostaje primary
- Poređenje rezultata i validacija
- A/B testing sa metrics

### Faza 2: Canary Deployment (2 nedelje)
- 10% uređaja → novi sistem
- 90% uređaja → stari sistem
- Intensive monitoring
- Performance tuning

### Faza 3: Progressive Rollout (4 nedelje)
```
Nedelja 1: 25% traffic
Nedelja 2: 50% traffic
Nedelja 3: 75% traffic
Nedelja 4: 100% traffic
```
- Rollback plan spreman na svakom koraku
- Health checks i automated rollback

### Faza 4: Legacy Decommission (2 nedelje)
- Legacy sistem ostaje kao backup
- Cleanup i optimizacija
- Dokumentacija update
- Knowledge transfer

## ✅ Prednosti Arhitekture

1. **Skalabilnost** - Horizontalno skaliranje svih komponenti
2. **Resilience** - Queue garantuje delivery, raw backup omogućava replay
3. **Zero Downtime** - Postupna migracija bez prekida servisa
4. **Monitoring** - Full observability sa tracing
5. **Vendor Agnostic** - Lako menjate komponente
6. **Performance** - 100x bolji throughput vs trenutni sistem
7. **Replay Capability** - Re-procesiranje istorijskih podataka
8. **Multi-tenancy** - Podrška za više organizacija

## 📦 Technology Stack

| Component | Technology | Razlog izbora |
|-----------|------------|---------------|
| TCP Multiplexer | Go | High performance, low latency |
| Message Queue | RabbitMQ | Battle-tested, reliable |
| Raw Storage | MinIO | S3 compatible, on-premise |
| Smart City Consumer | Node.js/NestJS | Existing expertise |
| Legacy Consumer | PHP | Compatibility |
| Time-series DB | TimescaleDB | PostGIS support, compression |
| Monitoring | Prometheus + Grafana | Industry standard |
| Tracing | Jaeger | Distributed tracing |
| API Gateway | Kong/Traefik | Rate limiting, auth |

## 🚦 Quick Start (Minimalna verzija)

Za početak, možete implementirati jednostavniju verziju:

```php
// Dodati u util_teltonika.php nakon čuvanja
private function sendToSmartCity($gps_data, $garage_no, $imei) {
    $payload = [
        'imei' => $imei,
        'garage_no' => $garage_no,
        'timestamp' => $gps_data['timestamp'],
        'lat' => $gps_data['latitude'],
        'lng' => $gps_data['longitude'],
        'speed' => $gps_data['speed'],
        'course' => $gps_data['angle'],
        'altitude' => $gps_data['altitude'],
        'io_data' => $gps_data['io'] ?? []
    ];
    
    // Async POST da ne blokira
    $cmd = sprintf(
        'curl -X POST https://adminapi.smart-city.rs/gps-ingest/teltonika \
        -H "Content-Type: application/json" \
        -H "X-API-Key: %s" \
        -d %s > /dev/null 2>&1 &',
        getenv('SMARTCITY_API_KEY'),
        escapeshellarg(json_encode($payload))
    );
    exec($cmd);
}
```

## 📝 Rollback Plan

U slučaju problema, vraćanje na stari sistem:

1. **Instant rollback** - Prebaciti traffic na legacy (< 1 min)
2. **Data recovery** - Replay iz raw storage
3. **Validation** - Provera integriteta podataka
4. **Post-mortem** - Analiza problema

## 🔗 Reference

- [Teltonika Protocol Documentation](https://wiki.teltonika-gps.com/view/Codec)
- [TimescaleDB Best Practices](https://docs.timescale.com/timescaledb/latest/how-to-guides/best-practices/)
- [RabbitMQ Reliability Guide](https://www.rabbitmq.com/reliability.html)
- [Go TCP Server Performance](https://github.com/smallnest/1m-go-tcp-server)

## 📞 Kontakti

- Legacy sistem admin: root@79.101.48.11
- Smart City DevOps: devops@smart-city.rs
- Teltonika support: support@teltonika-gps.com

---
*Dokument će se ažurirati tokom implementacije sa konkretnim config fajlovima i skriptama.*