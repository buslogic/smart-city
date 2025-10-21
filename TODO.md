# TODO - Smart City Vodovod Integracija

## 🎯 Sledeća sesija: Sinhronizacija podataka sa legacy baze

### Faza 1: Prisma Schema - Lokalna baza struktura
- [ ] Analiziraj legacy bazu strukturu (postojeće tabele)
- [ ] Dodaj Prisma modele za sve vodovod tabele u `apps/backend/prisma/schema.prisma`
- [ ] Kreiraj Prisma migracije za lokalne tabele
- [ ] Proveri i primeni migracije na lokalnu MySQL bazu

### Faza 2: Sinhronizacioni servisi
- [ ] Kreiraj sync servis za vodovod module (sličan `VehicleSyncService`)
- [ ] Implementiraj logiku za povlačenje podataka iz legacy baze
- [ ] Implementiraj transformaciju podataka (legacy → Prisma modeli)
- [ ] Dodaj sync za sledeće entitete:
  - [ ] Campaigns i SubCampaigns
  - [ ] BillingCampaigns
  - [ ] WaterMeters i MeasuringPoints
  - [ ] WaterServices i WaterServicePrices
  - [ ] Readings i ReadingLists
  - [ ] Complaints
  - [ ] Payments i Cashiers
  - [ ] WaterSystemRegions, Cities, Streets, Zones
  - [ ] UserAccounts
  - [ ] Subsidies
  - [ ] Ostali entiteti...

### Faza 3: Refaktorisanje kontrolera
- [ ] Zameni čiste SQL upite sa Prisma klijentom u svim kontrolerima
- [ ] Testiraj sve API endpointe posle refaktorisanja
- [ ] Proveri da li sve funkcioniše sa lokalnom bazom umesto legacy baze

### Faza 4: Testing i validacija
- [ ] Testiraj sinhronizaciju podataka (legacy → local)
- [ ] Proveri integritet podataka
- [ ] Testiraj sve CRUD operacije preko API-ja
- [ ] Proveri da li frontend radi sa novim API-jem

## 📋 Napomene

### Legacy baza
- **Host**: 192.168.1.100:3306
- **Database**: `vodovod_2013`
- **Konekcija**: `PrismaLegacyService` (već postoji)

### Lokalna baza
- **Host**: localhost:3325 (Docker)
- **Database**: `smartcity`
- **Konekcija**: `PrismaService` (glavni servis)

### Reference kod
- `VehicleSyncService` - primer sinhronizacionog servisa
- `GpsSyncService` - drugi primer sync servisa
- `PrismaLegacyService` - servis za pristup legacy bazi

## ⚠️ Važno
- Svi kontroleri su već prebačeni i rade sa legacy bazom direktno
- Potrebno je zadržati iste API endpointe i response formate
- Frontend ne bi trebalo da primeti razliku posle refaktorisanja
