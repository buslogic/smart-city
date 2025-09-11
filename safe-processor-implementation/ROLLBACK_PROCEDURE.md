# 🔄 ROLLBACK PROCEDURA

## ⚠️ HITNA ROLLBACK PROCEDURA

Ako nešto pođe po zlu tokom deployment-a, sledi ove korake:

### 1. INSTANT ROLLBACK (< 1 minut)

```bash
# Automatski rollback svih instanci
cd /home/kocev/smart-city/safe-processor-implementation
./deploy-safe-processor.sh rollback
```

### 2. MANUAL ROLLBACK (ako automatski ne radi)

```bash
# Za sve instance odjednom
for i in {60..76}; do
  ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 \
    "cp /var/www/teltonika$i/smart-city-raw-processor.php.backup-20250911 \
        /var/www/teltonika$i/smart-city-raw-processor.php"
done
```

### 3. PARTIAL ROLLBACK (samo problematične instance)

```bash
# Rollback samo specifične instance
INSTANCES="70 71 72"  # Lista problematičnih
for i in $INSTANCES; do
  ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 \
    "cp /var/www/teltonika$i/smart-city-raw-processor.php.backup-safe-* \
        /var/www/teltonika$i/smart-city-raw-processor.php"
done
```

## 📊 PROVERA STANJA NAKON ROLLBACK-A

### Proveri da li processor radi:
```bash
for i in {60..76}; do
  echo -n "teltonika$i: "
  ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 \
    "cd /var/www/teltonika$i && timeout 5 php smart-city-raw-processor.php 2>&1 | grep 'Processing complete' && echo 'OK' || echo 'FAIL'"
done
```

### Proveri pending queue (trebalo bi da ne postoji):
```bash
for i in {60..76}; do
  echo -n "teltonika$i pending: "
  ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 \
    "test -f /var/www/teltonika$i/smart-city-gps-pending.txt && wc -l /var/www/teltonika$i/smart-city-gps-pending.txt || echo '0'"
done
```

## 🔍 TROUBLESHOOTING

### Problem: Processor ne procesira podatke
```bash
# Proveri log
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 \
  "tail -50 /var/log/cron | grep teltonika"

# Proveri da li postoje raw podaci
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 \
  "wc -l /var/www/teltonika70/smart-city-gps-raw-log.txt"
```

### Problem: Pending file raste
```bash
# Proveri da li server odgovara
curl -X POST https://api.smart-city.rs/api/gps-ingest/batch \
  -H "X-API-Key: gps-legacy-key-2025-secure" \
  -H "Content-Type: application/json" \
  -d '{"data":[]}'

# Forsiraj procesiranje pending-a
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 \
  "cd /var/www/teltonika70 && php smart-city-raw-processor-safe.php"
```

### Problem: Disk se puni
```bash
# Proveri disk usage
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 \
  "du -sh /var/www/teltonika*/processed_logs/"

# Forsiraj cleanup
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11 \
  "cd /var/www/teltonika70 && rm -f processed_logs/.last_cleanup && php smart-city-raw-processor-safe.php"
```

## 📋 ROLLBACK CHECKLIST

- [ ] Identifikovan problem
- [ ] Rollback izvršen
- [ ] CRON jobs rade normalno
- [ ] Nema pending fajlova
- [ ] Raw log se procesira
- [ ] Server prima podatke
- [ ] Disk space OK
- [ ] Tim obavešten

## 📞 KONTAKTI ZA PODRŠKU

- **DevOps**: Proveri sa timom pre rollback-a
- **Monitoring**: Proveri Grafana dashboard
- **Legacy server admin**: root@79.101.48.11

## 💾 BACKUP LOKACIJE

Backup fajlovi se nalaze na:
1. Legacy server: `/var/www/teltonikaNUM/smart-city-raw-processor.php.backup-*`
2. Lokalno: `/home/kocev/smart-city/legacy-server-backup/teltonika/`
3. Safe processor: `/home/kocev/smart-city/safe-processor-implementation/`

## ⏰ VREME OPORAVKA

- **Rollback**: < 1 minut
- **Verifikacija**: 5 minuta
- **Stabilizacija**: 10-15 minuta
- **Full recovery**: 30 minuta max

## 📝 POST-MORTEM

Nakon rollback-a, dokumentuj:
1. Šta je pošlo po zlu?
2. Koji simptomi su primećeni?
3. Koliko je trajao incident?
4. Koji podaci su potencijalno izgubljeni?
5. Kako sprečiti u budućnosti?

Sačuvaj post-mortem u: `/home/kocev/smart-city/safe-processor-implementation/incidents/`