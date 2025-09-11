# 🔒 SAFE PROCESSOR IMPLEMENTATION PLAN

**Datum**: 11. septembar 2025  
**Cilj**: Implementacija sigurnog GPS processor sistema koji ne gubi podatke

## 📋 MASTER TODO LISTA

### FAZA 1: PRIPREMA (15 min)
- [ ] 1.1 Kreirati backup trenutnih processor skripti na svim instancama
- [ ] 1.2 Kreirati test instancu (teltonika60) za initial testing
- [ ] 1.3 Dokumentovati trenutno stanje (broj fajlova, veličina)
- [ ] 1.4 Kreirati rollback skripte

### FAZA 2: DEVELOPMENT (30 min)
- [ ] 2.1 Kreirati `smart-city-raw-processor-safe.php` sa transakcione logike
- [ ] 2.2 Dodati pending file management
- [ ] 2.3 Implementirati batch tracking
- [ ] 2.4 Dodati error recovery mehanizam
- [ ] 2.5 Integrisati postojeći cleanup kod
- [ ] 2.6 Dodati detailed logging

### FAZA 3: TESTING (30 min)
- [ ] 3.1 Test sa malim brojem podataka (100 linija)
- [ ] 3.2 Test sa velikim brojem podataka (10,000+ linija)
- [ ] 3.3 Test server failure scenario (simulirati pad servera)
- [ ] 3.4 Test script crash scenario (kill -9)
- [ ] 3.5 Test concurrent execution (race conditions)
- [ ] 3.6 Performance benchmark

### FAZA 4: STAGED DEPLOYMENT (45 min)
- [ ] 4.1 Deploy na test instancu (teltonika60)
- [ ] 4.2 Monitor 10 minuta
- [ ] 4.3 Deploy na low-traffic instance (teltonika61-63)
- [ ] 4.4 Monitor 30 minuta
- [ ] 4.5 Deploy na medium-traffic (teltonika64-69)
- [ ] 4.6 Monitor 1 sat
- [ ] 4.7 Deploy na high-traffic (teltonika70-76)
- [ ] 4.8 Final monitoring

### FAZA 5: VALIDATION (15 min)
- [ ] 5.1 Verifikovati da nema lost data
- [ ] 5.2 Proveriti pending queue status
- [ ] 5.3 Analizirati log fajlove
- [ ] 5.4 Proveriti disk usage
- [ ] 5.5 Potvrditi cleanup funkcioniše

### FAZA 6: DOCUMENTATION (10 min)
- [ ] 6.1 Update README sa novim workflow
- [ ] 6.2 Dokumentovati troubleshooting procedure
- [ ] 6.3 Kreirati monitoring dashboard commands
- [ ] 6.4 Arhivirati stare verzije

## 🏗️ TEHNIČKA IMPLEMENTACIJA

### Struktura fajlova:
```
/var/www/teltonikaNUM/
├── smart-city-gps-raw-log.txt       # Ulazni podaci (kontinuirano se puni)
├── smart-city-gps-pending.txt       # Queue za procesiranje (NEW!)
├── processed_logs/                  # Uspešno poslati
│   └── 2025/09/11/*.processed
├── failed_logs/                     # Za debug (zadržati postojeće)
└── backups/                         # Automatic backups (NEW!)
    └── raw_*.txt
```

### Algoritam:
```
1. START
2. IF pending.txt EXISTS:
     LOAD pending lines
3. IF raw-log.txt EXISTS:
     LOAD new lines
     APPEND to pending
     CLEAR raw-log.txt
4. LIMIT to 10,000 lines
5. FOR each batch of 200:
     TRY send to server
     IF success:
        ADD to successful[]
     ELSE:
        ADD to failed[]
6. SAVE successful to processed_logs/
7. SAVE (failed + remaining) to pending.txt
8. END
```

### Critical Points:
- **ATOMICITY**: Raw → Pending → Processed (nikad između)
- **IDEMPOTENCY**: Može se pokrenuti više puta bez problema
- **RECOVERY**: Crash-safe na bilo kojoj tački

## 🚀 DEPLOYMENT STRATEGIJA

### Stage 1: Test (teltonika60)
```bash
# Deploy
scp smart-city-raw-processor-safe.php root@79.101.48.11:/var/www/teltonika60/
ssh root@79.101.48.11 "cd /var/www/teltonika60 && php smart-city-raw-processor-safe.php"

# Monitor
watch -n 5 "ls -la /var/www/teltonika60/*.txt"
```

### Stage 2: Gradual Rollout
```bash
# Low traffic (61-63)
for i in 61 62 63; do
  scp processor-safe.php root@79.101.48.11:/var/www/teltonika$i/
done

# Medium traffic (64-69)
for i in {64..69}; do
  scp processor-safe.php root@79.101.48.11:/var/www/teltonika$i/
done

# High traffic (70-76)
for i in {70..76}; do
  scp processor-safe.php root@79.101.48.11:/var/www/teltonika$i/
done
```

## 🔄 ROLLBACK PLAN

Ako nešto pođe po zlu:
```bash
# Instant rollback
for i in {60..76}; do
  ssh root@79.101.48.11 "cp /var/www/teltonika$i/smart-city-raw-processor.php.backup-20250911 /var/www/teltonika$i/smart-city-raw-processor.php"
done
```

## 📊 SUCCESS METRICS

- ✅ Zero data loss nakon 24h
- ✅ Pending queue < 10,000 linija
- ✅ Processing time < 5 sekundi
- ✅ No memory errors
- ✅ Cleanup i dalje funkcioniše

## ⚠️ RIZICI I MITIGACIJE

| Rizik | Verovatnoća | Impact | Mitigacija |
|-------|-------------|---------|------------|
| Data corruption | Low | High | Backup pre svake operacije |
| Performance degradation | Medium | Medium | Limit na 10k linija |
| Disk full | Low | High | Cleanup stare backup-e |
| Race condition | Low | Medium | File locking (LOCK_EX) |
| Server timeout | High | Low | Retry mehanizam već postoji |

## 🛠️ MONITORING KOMANDE

```bash
# Status pending queue
for i in {60..76}; do
  echo -n "teltonika$i: "
  wc -l /var/www/teltonika$i/smart-city-gps-pending.txt 2>/dev/null || echo "0"
done

# Proveri da li ima stuck data
find /var/www/teltonika* -name "*pending*" -mmin +10 -ls

# Processing rate
tail -f /var/log/smart-city-raw-processor-*.log | grep "Processed:"
```

## 📝 NOTES

- Existing cleanup functionality MUST be preserved
- CRON jobs remain at */2 (every 2 minutes)
- API keys and endpoints unchanged
- Vehicle filter logic unchanged

## ✅ SIGN-OFF CHECKLIST

- [ ] All instances updated
- [ ] No data loss confirmed
- [ ] Performance acceptable
- [ ] Logs reviewed
- [ ] Team notified
- [ ] Documentation updated

---
**Estimated Total Time**: 2.5 hours  
**Risk Level**: Medium  
**Rollback Time**: 5 minutes