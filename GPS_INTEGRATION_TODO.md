# 📋 GPS Legacy Integration - TODO Lista
**Datum kreiranja: 02.09.2025**  
**Poslednje ažuriranje: 02.09.2025 09:00**  
**Status: FAZA 1 U TOKU - Backend implementacija**  
**Cilj: Implementacija GPS integracije sa MySQL buffer pristupom**

---

## 🎯 Pregled Projekta

Integracija GPS podataka sa legacy PHP sistema na Smart City platformu kroz MySQL buffer sa mogućnošću development testiranja.

---

## 📝 TODO Lista po fazama

### ✅ FAZA 0: Priprema i analiza [ZAVRŠENO]
- [x] Analiza legacy sistema na serveru 79.101.48.11
- [x] Identifikacija tačke integracije (util_teltonika.php, linija 435)
- [x] Dokumentovanje postojeće arhitekture
- [x] Definisanje strategije sa MySQL buffer pristupom
- [x] Kreiranje tehničke dokumentacije

---

### 🔄 FAZA 1: Smart City Backend priprema [U TOKU - 90% ZAVRŠENO]

#### 1.1 MySQL Buffer implementacija ✅ [ZAVRŠENO]
- [x] Kreirati `gps_raw_buffer` tabelu u DigitalOcean MySQL bazi
- [x] Dodati tabelu u Prisma schema
- [x] Generisati Prisma klijent
- [x] Kreirati migraciju

#### 1.2 API Endpoint modifikacija ✅ [ZAVRŠENO]
- [x] Modificirati `/gps-ingest/batch` endpoint za upis u MySQL buffer
- [x] Implementirati brz INSERT bez validacije
- [x] Dodati error handling
- [ ] Testirati endpoint sa Postman/Thunder Client ⏳

#### 1.3 TimescaleDB Processor servis ✅ [ZAVRŠENO]
- [x] Kreirati novi `GpsProcessorService`
- [x] Implementirati cron job (svakih 30 sekundi)
- [x] Dodati bulk INSERT u TimescaleDB
- [x] Implementirati retry logiku za neuspešne pokušaje
- [x] Dodati monitoring metode
- [x] Dodati GpsProcessorController sa status i manual process endpoint-ima
- [x] Dodati cleanup metod za stare failed zapise

#### 1.4 Development environment setup
- [ ] Kreirati test API key za legacy server
- [ ] Podesiti CORS za legacy server IP adrese
- [ ] Kreirati ngrok tunel za lokalni development (ili alternativa)
- [ ] Dokumentovati lokalne URL-ove za testiranje

---

### 📦 FAZA 2: Legacy Server priprema

#### 2.1 Backup postojećih fajlova
- [ ] SSH na server 79.101.48.11
- [ ] Backup `util_teltonika.php` za sve teltonika instance
- [ ] Backup `dbcred.inc.php` za sve teltonika instance
- [ ] Kreirati restore skriptu za brzi rollback

#### 2.2 Priprema test okruženja
- [ ] Izabrati teltonika60 kao test instancu
- [ ] Kreirati `smartcity_config.php` sa environment varijablama
- [ ] Dodati LOCAL_DEV i PRODUCTION URL opcije
- [ ] Implementirati switch za lako prebacivanje

#### 2.3 Implementacija PHP koda
- [ ] Dodati Smart City konfiguraciju u `dbcred.inc.php`
- [ ] Implementirati batch funkcije u `util_teltonika.php`
- [ ] Dodati poziv funkcije nakon INSERT-a (linija 435)
- [ ] Kreirati `smartcity_monitor.php` za praćenje

---

### 🧪 FAZA 3: Testiranje sa lokalnim development

#### 3.1 Lokalno testiranje
- [ ] Pokrenuti Smart City backend lokalno
- [ ] Podesiti ngrok ili SSH tunel za pristup sa legacy servera
- [ ] Konfigurirati teltonika60 da šalje na lokalni URL
- [ ] Omogućiti SMARTCITY_DEBUG mode
- [ ] Pratiti logove na oba sistema

#### 3.2 Verifikacija podataka
- [ ] Proveriti da li podaci stižu u MySQL buffer
- [ ] Proveriti cron job procesiranje
- [ ] Verifikovati upis u TimescaleDB
- [ ] Proveriti vehicle_id mapiranje

#### 3.3 Performance testiranje
- [ ] Testirati sa batch od 10 GPS tačaka
- [ ] Povećati na 50 tačaka
- [ ] Meriti latenciju
- [ ] Proveriti CPU/Memory impact na legacy serveru

---

### 🚀 FAZA 4: Staging deployment

#### 4.1 Deploy na DigitalOcean
- [ ] Deploy backend promena na staging
- [ ] Kreirati staging API key
- [ ] Testirati konekciju sa legacy servera
- [ ] Promeniti URL u teltonika60 na staging

#### 4.2 Monitoring period (24h)
- [ ] Pratiti MySQL buffer status
- [ ] Proveriti TimescaleDB upis
- [ ] Analizirati logove za greške
- [ ] Meriti performanse

#### 4.3 Gradual rollout
- [ ] Omogućiti za teltonika61 i teltonika62
- [ ] Monitor 48h
- [ ] Analiza rezultata

---

### 🎯 FAZA 5: Production deployment

#### 5.1 Finalne pripreme
- [ ] Code review svih promena
- [ ] Ažurirati dokumentaciju
- [ ] Kreirati production API ključeve
- [ ] Backup svih sistema

#### 5.2 Production deployment
- [ ] Deploy backend na production
- [ ] Prebaciti teltonika60 na production URL
- [ ] Verifikovati rad 1 sat
- [ ] Postupno uključiti ostale instance (60-76)

#### 5.3 Monitoring i optimizacija
- [ ] Pratiti performanse 7 dana
- [ ] Optimizovati batch size prema potrebi
- [ ] Implementirati dodatne optimizacije
- [ ] Dokumentovati sve probleme i rešenja

---

### 🛡️ FAZA 6: Stabilizacija

#### 6.1 Monitoring setup
- [ ] Postaviti alerting za buffer overflow
- [ ] Kreirati dashboard za praćenje
- [ ] Implementirati health check endpoint
- [ ] Dokumentovati SOP za održavanje

#### 6.2 Optimizacije
- [ ] Implementirati kompresiju podataka
- [ ] Optimizovati indekse u MySQL buffer tabeli
- [ ] Razmotriti particioniranje tabele
- [ ] Implementirati arhiviranje starih podataka

#### 6.3 Dokumentacija
- [ ] Ažurirati svu tehničku dokumentaciju
- [ ] Kreirati user guide za operatore
- [ ] Dokumentovati troubleshooting postupke
- [ ] Kreirati runbook za incident response

---

## ⏱️ Vremenska procena

| Faza | Procenjeno trajanje | Status | Napredak |
|------|-------------------|---------|----------|
| FAZA 0 | ✅ Završeno | Završeno | 100% |
| FAZA 1 | 2-3 dana | U toku | 90% |
| FAZA 2 | 1 dan | Čeka | 0% |
| FAZA 3 | 2-3 dana | Čeka | 0% |
| FAZA 4 | 3-5 dana | Čeka | 0% |
| FAZA 5 | 2-3 dana | Čeka | 0% |
| FAZA 6 | Ongoing | Čeka | 0% |

**Ukupno**: ~2-3 nedelje za potpunu implementaciju

---

## 🔧 Potrebni resursi

### Pristupi
- ✅ SSH pristup na legacy server (79.101.48.11)
- ✅ Pristup DigitalOcean serveru
- ✅ Pristup TimescaleDB
- ⏳ API ključevi za integraciju

### Alati
- ✅ SSH klijent
- ✅ Code editor (VS Code)
- ✅ Postman/Thunder Client
- ⏳ ngrok ili alternativa za tunneling
- ✅ MySQL Workbench ili DBeaver

### Tim
- Developer za backend
- DevOps za deployment
- QA za testiranje
- Project manager za koordinaciju

---

## 🚨 Rizici i mitigacije

| Rizik | Verovatnoća | Impact | Mitigacija |
|-------|------------|---------|------------|
| Prekid GPS servisa | Niska | Visok | Instant rollback procedura |
| Preopterećenje legacy servera | Srednja | Srednji | Async slanje, batch tuning |
| Gubitak podataka | Niska | Visok | MySQL buffer pristup |
| Network problemi | Srednja | Nizak | Retry logika, local queue |
| TimescaleDB down | Niska | Srednji | Buffer zadržava podatke |

---

## 📞 Kontakti

- **Legacy sistem**: root@79.101.48.11
- **Smart City backend**: admin@smart-city.rs
- **On-call podrška**: TBD

---

## 📝 Napomene

### 🎉 Implementirane funkcionalnosti (02.09.2025)

#### Backend implementacija završena:
1. **MySQL Buffer tabela** (`gps_raw_buffer`)
   - Struktura sa svim potrebnim poljima
   - Index na `process_status` i `received_at`
   - Retry logika sa counter i error message

2. **GpsIngestService modifikovan**
   - Sada upisuje u MySQL buffer umesto direktno u TimescaleDB
   - Bulk insert sa `createMany`
   - Mapiranje vehicle_id preko garage_no

3. **GpsProcessorService kreiran**
   - Cron job svakih 30 sekundi
   - Batch procesiranje (1000 zapisa odjednom)
   - FOR UPDATE SKIP LOCKED za konkurentnost
   - Retry logika za failed zapise
   - Monitoring i cleanup metode

4. **GpsProcessorController**
   - GET `/gps-processor/status` - status buffer-a
   - POST `/gps-processor/process` - ručno pokretanje
   - POST `/gps-processor/cleanup` - čišćenje starih failed zapisa

5. **Integracija sa postojećim sistemom**
   - Manualni GPS sync sada takođe koristi MySQL buffer
   - Jedinstveni pipeline za sve GPS podatke

### Prioriteti
1. **Ne prekinuti postojeći GPS servis**
2. **Omogućiti lako vraćanje na staro**
3. **Minimalan impact na legacy sistem**
4. **Postepeni rollout sa monitoringom**

### Development URLs
```bash
# Local development (sa ngrok ili tunel)
LOCAL_DEV_URL=https://[ngrok-subdomain].ngrok.io/api/gps-ingest/batch

# Staging
STAGING_URL=https://staging.smart-city.rs/api/gps-ingest/batch

# Production
PRODUCTION_URL=https://gsp-admin.smart-city.rs/api/gps-ingest/batch
```

### Quick switch u PHP kodu
```php
// U dbcred.inc.php
define("SMARTCITY_ENV", "LOCAL"); // LOCAL | STAGING | PRODUCTION

// Automatski switch
switch(SMARTCITY_ENV) {
    case "LOCAL":
        define("SMARTCITY_API_URL", "https://xxx.ngrok.io/api/gps-ingest/batch");
        break;
    case "STAGING":
        define("SMARTCITY_API_URL", "https://staging.smart-city.rs/api/gps-ingest/batch");
        break;
    case "PRODUCTION":
        define("SMARTCITY_API_URL", "https://gsp-admin.smart-city.rs/api/gps-ingest/batch");
        break;
}
```

---

## ✅ Definition of Done

Integracija se smatra završenom kada:
1. Svih 17 teltonika instanci šalje podatke
2. MySQL buffer stabilan 7 dana bez overflow
3. TimescaleDB prima 99.9% podataka
4. Monitoring i alerting postavljeni
5. Dokumentacija kompletna
6. Tim obučen za održavanje

---

*Poslednje ažuriranje: 02.09.2025 09:00*  
*Status: FAZA 1 - 90% završeno, spremno za testiranje*  
*Sledeći korak: Testiranje endpoint-a i kreiranje API ključa*