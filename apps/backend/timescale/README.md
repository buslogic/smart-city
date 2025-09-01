# TimescaleDB Migracije - KRITIČNO UPUTSTVO ⚠️

## 🚨 OBAVEZNO PROČITATI PRE RADA SA MIGRACIJAMA 🚨

Ovaj direktorijum sadrži migracije za TimescaleDB bazu koja se koristi za GPS tracking i analitiku.

## 📁 Struktura

```
timescale/
├── .env                  # DEFAULT konfiguracija (trenutno lokalna)
├── .env.local           # LOKALNA baza konfiguracija
├── .env.production      # PRODUKCIJSKA baza konfiguracija (Timescale Cloud)
├── dbmate.yml           # dbmate konfiguracija
├── migrations/          # SQL migracije
└── scripts/             # Pomoćne skripte
```

## ⚠️ KRITIČNO: Razlika između LOKALNE i PRODUKCIJSKE baze

### Lokalna baza
- **Host**: localhost:5433
- **Container**: smartcity-timescale-local
- **Database**: smartcity_gps
- **User**: smartcity_ts

### Produkcijska baza (Timescale Cloud)
- **Host**: b96osgyp1w.duvl2ceai2.tsdb.cloud.timescale.com:31143
- **Database**: tsdb
- **User**: tsdbadmin
- **⚠️ OVO JE LIVE BAZA SA PRAVIM PODACIMA!**

## 🛠️ Kako raditi sa migracijama

### 1. LOKALNI DEVELOPMENT

```bash
# Prelazak u timescale direktorijum
cd apps/backend/timescale

# Učitaj LOKALNE environment varijable
source .env.local
# ili
export DATABASE_URL=$(cat .env.local | grep DATABASE_URL | cut -d '=' -f2)

# Proveri status migracija
export PATH=$PATH:~/bin && dbmate status

# Kreiraj novu migraciju
export PATH=$PATH:~/bin && dbmate new naziv_migracije

# Primeni migracije
export PATH=$PATH:~/bin && dbmate up

# Rollback poslednje migracije
export PATH=$PATH:~/bin && dbmate rollback
```

### 2. PRODUKCIJA (⚠️ OPREZNO!)

```bash
# ⛔ STANI! Pre nego što nastaviš:
# 1. Da li si testirao migraciju lokalno?
# 2. Da li si napravio backup produkcijske baze?
# 3. Da li si siguran da treba da radiš ovo?

# Ako si siguran, nastavi:

# Učitaj PRODUKCIJSKE environment varijable
source .env.production
# ili
export DATABASE_URL=$(cat .env.production | grep DATABASE_URL | cut -d '=' -f2)

# PRVO proveri status
export PATH=$PATH:~/bin && dbmate status

# Tek onda primeni migracije
export PATH=$PATH:~/bin && dbmate up
```

## 📝 Pravila pisanja migracija

1. **UVEK testiraj lokalno pre produkcije**
2. **Svaka migracija mora imati `migrate:up` i `migrate:down` sekcije**
3. **Koristi IF EXISTS/IF NOT EXISTS za idempotentnost**
4. **Dodaj RAISE NOTICE za praćenje izvršavanja**
5. **Za TimescaleDB specifično:**
   - Koristi CASCADE za brisanje sa chunk-ova
   - Proveri kompresiju pre modifikacije
   - Pazi na hypertable specifičnosti

## 🔍 Korisne komande za proveru

```bash
# Proveri koja baza se trenutno koristi
echo $DATABASE_URL

# Proveri status migracija u LOKALNOJ bazi
source .env.local && export PATH=$PATH:~/bin && dbmate status

# Proveri status migracija u PRODUKCIJSKOJ bazi
source .env.production && export PATH=$PATH:~/bin && dbmate status

# Direktan pristup lokalnoj bazi
docker exec -it smartcity-timescale-local psql -U smartcity_ts -d smartcity_gps

# Lista svih funkcija u bazi
\df *driving*
\df *aggressive*

# Lista svih tabela
\dt
```

## ❌ ČESTE GREŠKE

1. **Migracija se primenjuje na pogrešnu bazu**
   - Uvek proveri `echo $DATABASE_URL` pre rada
   - Koristi `source .env.local` ili `source .env.production`

2. **Rollback briše funkcije ali up ih ne vraća**
   - dbmate pamti da je migracija primenjena
   - Moraš eksplicitno da uradiš `rollback` pa `up`

3. **Različite verzije funkcija između lokalne i produkcijske baze**
   - Uvek sinhronizuj migracije
   - Proveri status na obe baze

## 🚀 Skripta za bezbednu migraciju

Koristi skripte iz `scripts/` direktorijuma:

```bash
# Za lokalne migracije
./scripts/migrate-local.sh

# Za produkcijske migracije (sa dodatnim proverama)
./scripts/migrate-production.sh
```

## 📞 Kontakt za pomoć

Ako nešto nije jasno ili imaš problema sa migracijama, OBAVEZNO pitaj pre nego što radiš sa produkcijskom bazom!