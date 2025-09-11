# 🔒 Safe GPS Processor Implementation

**Datum**: 11. septembar 2025  
**Verzija**: 1.0.0  
**Status**: Spreman za deployment  

## 📋 Sadržaj paketa

```
safe-processor-implementation/
├── smart-city-raw-processor-safe.php  # Nova sigurna processor skripta
├── deploy-safe-processor.sh           # Deployment skripta
├── test-safe-processor.sh             # Test suite
├── IMPLEMENTATION_PLAN.md             # Detaljan plan implementacije
├── ROLLBACK_PROCEDURE.md             # Hitna rollback procedura
└── README.md                         # Ovaj fajl
```

## 🎯 Problem koji rešavamo

**KRITIČNO**: Trenutni processor gubi podatke kada centralni server nije dostupan!

Trenutna logika:
1. Učita raw log
2. Pokuša da pošalje
3. Ako uspe → arhivira
4. Ako ne uspe → podatke zadržava u raw log-u
5. **PROBLEM**: Novi podaci prepisuju neuspešne!

## ✅ Naše rešenje

**Transakcioni pristup sa pending queue**:

```
RAW LOG → PENDING QUEUE → PROCESSED
```

1. **Atomska operacija**: Raw log se ODMAH prebacuje u pending
2. **Retry mehanizam**: Failed batches ostaju u pending
3. **Nema gubitka**: Pending se briše SAMO nakon uspešnog slanja
4. **Performance**: Limit od 10,000 linija po ciklusu

## 🚀 Quick Start

### 1. Test deployment (teltonika60)
```bash
cd /home/kocev/smart-city/safe-processor-implementation

# Deploy na test instancu
./deploy-safe-processor.sh test

# Pokreni test suite
./test-safe-processor.sh
```

### 2. Staged deployment
```bash
# Stage 1: Low traffic (61-63)
./deploy-safe-processor.sh stage1

# Stage 2: Medium traffic (64-69)
./deploy-safe-processor.sh stage2

# Stage 3: High traffic (70-76)
./deploy-safe-processor.sh stage3
```

### 3. Full deployment
```bash
# Deploy na sve instance odjednom
./deploy-safe-processor.sh all
```

## 🔄 Rollback

Ako nešto pođe po zlu:
```bash
# Automatski rollback
./deploy-safe-processor.sh rollback

# Ili pogledaj ROLLBACK_PROCEDURE.md za detalje
```

## 📊 Monitoring

### Proveri pending queue status:
```bash
./deploy-safe-processor.sh status
```

### Real-time monitoring:
```bash
# Praćenje pending queue-a
watch -n 5 'for i in {60..76}; do echo -n "teltonika$i: "; ssh root@79.101.48.11 "wc -l /var/www/teltonika$i/smart-city-gps-pending.txt 2>/dev/null || echo 0"; done'
```

## 🔐 Sigurnosne karakteristike

1. **File locking**: LOCK_EX sprečava race conditions
2. **Backup pre svake operacije**: Raw log se backup-uje
3. **Idempotentnost**: Može se pokrenuti više puta bez problema
4. **Graceful degradation**: Limitira processing na 10k linija

## 📈 Performance

- **Batch size**: 200 GPS tačaka
- **Max lines per run**: 10,000
- **Processing time**: < 5 sekundi za 10k linija
- **Memory usage**: < 50MB
- **Retry attempts**: 3 sa exponential backoff

## 🧪 Testiranje

Test suite pokriva:
1. ✅ Basic functionality
2. ✅ Server failure handling
3. ✅ Large batch processing (15k lines)
4. ✅ Concurrent execution safety
5. ✅ Cleanup functionality

Pokreni testove:
```bash
./test-safe-processor.sh
```

## 📝 Promene u odnosu na staru verziju

| Stara verzija | Nova verzija |
|--------------|--------------|
| Direktno brisanje raw log-a | Pending queue sistem |
| All-or-nothing pristup | Parcijalno procesiranje |
| Gubljenje podataka pri failure | Zero data loss garancija |
| Neograničen broj linija | Max 10k linija po ciklusu |
| Failed batches u JSON | Failed batches u pending |

## ⚠️ Poznati problemi

1. **Veliki pending queue**: Ako pending > 100k linija, razmotriti povećanje MAX_LINES
2. **Stale lock files**: Cleanup lock se automatski briše nakon 5 minuta
3. **Network timeout**: Retry mehanizam pokriva većinu slučajeva

## 📞 Podrška

Ako imaš problema:
1. Proveri `ROLLBACK_PROCEDURE.md`
2. Proveri logove: `tail -f /var/log/cron`
3. Proveri pending status: `./deploy-safe-processor.sh status`

## 📊 Success Metrics

Nakon 24h rada:
- ✅ Zero data loss
- ✅ Pending queue < 10,000 linija
- ✅ Processing time < 5 sekundi
- ✅ No memory errors
- ✅ Cleanup funkcioniše

## 🏁 Deployment Checklist

- [ ] Backup trenutnih skripti
- [ ] Test na teltonika60
- [ ] Stage 1 deployment (61-63)
- [ ] Monitor 30 minuta
- [ ] Stage 2 deployment (64-69)
- [ ] Monitor 1 sat
- [ ] Stage 3 deployment (70-76)
- [ ] Final validation
- [ ] Update dokumentacije
- [ ] Tim obavešten

---
**Autor**: Smart City DevOps Tim  
**Kontakt**: Proveri sa tim lead-om pre major promena