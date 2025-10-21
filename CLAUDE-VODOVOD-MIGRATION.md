# 🚰 Vodovod Migration Guide

Vodič za migraciju vodovod funkcionalnosti sa PHP projekta (ticketing-2018) na NestJS/React Smart City projekat.

---

## 🎯 Osnovna saznanja iz PHP → NestJS migracije

### 1. **Legacy baza i Raw SQL**
- Sve vodovod tabele (`ordering_*`, `vodovod_*`) su u legacy MySQL bazi na **192.168.4.208**
- Koristi **PrismaLegacyService** i `$queryRawUnsafe` / `$executeRawUnsafe`
- **NEMA** Prisma models za legacy tabele - samo raw SQL queries
- Tabele: `ordering_cities`, `ordering_addresses`, `vodovod_regions`, `vodovod_water_meters`, itd.

### 🔴 KRITIČNO: NE PRAVI NOVE TABELE!
- **NE** pravi Prisma models za vodovod tabele
- **NE** pravi Prisma migracije za vodovod tabele
- **NE** koristi Prisma Client za vodovod podatke
- **SAMO** raw SQL preko PrismaLegacyService
- **SAMO** MySQL na 192.168.4.208 (legacy baza)
- **KOPIRATI** SQL upite direktno iz PHP Model fajlova (`ReadingsModel.php`, itd.)
- Tek na KRAJU, kada SVE radi sa legacy bazom, tek onda se razmatra Prisma migracija

### 2. **PHP Controller → NestJS struktura**
```
PHP ticketing-2018:
  WaterSystemCitiesController.php → getRows(), create(), update(), delete()

NestJS Smart City:
  water-system-cities/
    ├── dto/                      # Validacija input-a
    ├── entities/                 # TypeScript tipovi
    ├── controller.ts             # REST endpoints
    ├── service.ts                # Business logika + SQL
    └── module.ts                 # Dependency injection
```

### 3. **fetchPostData → API instanca**
PHP projekat koristi `fetchPostData()` sa relativnim putanjama.

**UVEK zameni sa:**
```typescript
import { api } from '@/services/api';

// Svi pozivi kroz api instancu (automatski JWT + baseURL)
api.get('/api/water-system-cities')
api.post('/api/water-system-cities', data)
api.put('/api/water-system-cities/123', data)
api.delete('/api/water-system-cities/123')
```

### 4. **SearchList komponenta**
Za dropdown/autocomplete polja koja čitaju iz drugih tabela:

**Kritično pravilo:**
- Dodaj `fetchOnRender={true}` - inače nema rezultata pri otvaranju modala!
- Backend mora da ima `/search-list` POST endpoint koji vraća: `{ data: string[], hasMore: boolean }`
- Format podataka: `"ID | Naziv"` (npr. `"5 | Novi Sad"`)

### 5. **CSV Import/Export**
- Backend: `@Get('export-csv')` i `@Post('import-csv')` sa `FileInterceptor`
- Frontend: Koristi postojeće `exportCSV()` i `importCSV()` iz `@/utils/csv`
- Dugmad **pored** dugmeta "Dodaj" (ne zasebno!)

---

## 🔴 KRITIČNO: SUPER_ADMIN permisije

### **PRAVILO: Uvek dodaj permisije SUPER_ADMIN korisniku!**

Kada kreirаš novi backend modul, **OBAVEZNO** dodaj permisije u seed fajl:

**📍 Lokacija:** `/apps/backend/prisma/seed.ts`

**Primer:**
```typescript
// Dodaj u seedPermissions funkciju:
const waterSystemCitiesPermissions = await createResourcePermissions(
  'water_system_cities',
  'Vodovod - Gradovi/Naselja'
);

// Na KRAJU seed.ts, dodaj u SUPER_ADMIN permisije:
await prisma.rolePermission.createMany({
  data: [
    ...waterSystemCitiesPermissions.map(p => ({
      roleId: superAdminRole.id,
      permissionId: p.id,
    })),
  ],
  skipDuplicates: true,
});
```

**Provera permisija:**
```bash
# Pokreni seed da bi dodao permisije:
cd apps/backend
npx prisma db seed
```

**Zašto je ovo važno:**
- Bez permisija → 403 Forbidden greške
- Moraš da se odjaviš/prijaviš ponovo da bi refresh token učitao nove permisije
- SUPER_ADMIN mora da ima SVE permisije automatski

---

## 📋 Migracija - Osnovni koraci

### **Backend (NestJS)**

1. **Kreiraj modul i fajlove:**
   ```bash
   npx nest g module water-system-NAZIV --no-spec
   npx nest g service water-system-NAZIV --no-spec
   npx nest g controller water-system-NAZIV --no-spec
   ```

2. **Module:** Dodaj `imports: [PrismaLegacyModule]`

3. **Service:** Raw SQL queries preko `PrismaLegacyService`
   - `findAll()`, `findOne()`, `create()`, `update()`, `remove()`
   - `exportCSV()`, `bulkInsert()`

4. **Controller:** REST endpoints sa `@RequirePermissions` guard-ovima
   - `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`
   - `GET /export-csv`, `POST /import-csv`

5. **Permisije:** Dodaj u `seed.ts` i dodeli SUPER_ADMIN-u

### **Frontend (React)**

1. **Zameni `fetchPostData` sa `api` pozivima**
   - `api.get()`, `api.post()`, `api.put()`, `api.delete()`

2. **CRUD handleri:**
   - Koristi `try/catch/finally` blokove
   - Ažuriraj state nakon uspešne operacije
   - Toast notifikacije za feedback

3. **CSV dugmad:**
   - Dodaj pored "Dodaj" dugmeta
   - Koristi `exportCSV()` i `importCSV()` iz utils
   - Endpoint putanje: `/api/water-system-NAZIV/import-csv`

4. **SearchList komponente:**
   - **UVEK** dodaj `fetchOnRender={true}`
   - Parsiranje: `newValue?.split(' | ')` da dobiješ ID i naziv

---

## ❌ Top 5 grešaka koje izbegavaj

### 1. **Zaboravljanje PrismaLegacyModule**
```typescript
// ❌ Service neće raditi
@Module({ providers: [Service] })

// ✅ Dodaj import
@Module({ imports: [PrismaLegacyModule], providers: [Service] })
```

### 2. **fetchPostData umesto api**
```typescript
// ❌ Ne radi u novom projektu
await fetchPostData('../Controller/getRows')

// ✅ Koristi api
await api.get('/api/water-system-cities')
```

### 3. **Zaboravljanje fetchOnRender u SearchList**
```typescript
// ❌ Nema rezultata na otvaranju
<SearchList endpoint="/api/..." />

// ✅ Učitava odmah
<SearchList endpoint="/api/..." fetchOnRender={true} />
```

### 4. **Zaboravljanje SUPER_ADMIN permisija**
```typescript
// ❌ Kreirao novi modul ali nema permisije
// Rezultat: 403 Forbidden

// ✅ Dodaj u seed.ts i pokreni seed
```

### 5. **Pogrešan format permissions guard-a**
```typescript
// ❌ Kratak naziv
@RequirePermissions('cities:read')

// ✅ Pun naziv modula
@RequirePermissions('water_system_cities:read')
```

---

## ✅ Checklist za novu stranicu

### Pre početka:
- [ ] Pogledaj staru PHP stranicu u ticketing-2018 projektu
- [ ] Identifikuj tabelu u legacy bazi
- [ ] Proveri strukturu podataka (kolone, relacije)

### Backend:
- [ ] Kreiraj module/service/controller
- [ ] Dodaj PrismaLegacyModule u module
- [ ] Implementiraj sve CRUD metode u servisu
- [ ] Dodaj REST endpoints u controller-u
- [ ] Dodaj `@RequirePermissions` guard na sve rute
- [ ] **Dodaj permisije u seed.ts i dodeli SUPER_ADMIN-u**
- [ ] Pokreni seed: `npx prisma db seed`
- [ ] Testiraj API pozive (curl/Postman)

### Frontend:
- [ ] Kreiraj Page komponentu
- [ ] Zameni sve `fetchPostData` sa `api`
- [ ] Implementiraj CRUD handlere
- [ ] Dodaj CSV dugmad pored "Dodaj"
- [ ] Ako ima lookup polja - dodaj SearchList sa `fetchOnRender={true}`
- [ ] Testiraj u browseru
- [ ] Testiraj CSV import/export

### Završno:
- [ ] Proveri TypeScript greške: `npx tsc --noEmit`
- [ ] Testiraj sve operacije (CRUD + CSV)
- [ ] Odjavi se i prijavi ponovo (refresh permisija)
- [ ] Proveri da li SUPER_ADMIN ima pristup

---

## 📚 Lokacije važnih fajlova

### Projekti:
- **Stari PHP:** `/Users/kostaarsic/Work/ticketing-2018`
- **Novi NestJS:** `/Users/kostaarsic/Work/smart-city`

### Backend:
- **Seed permisije:** `apps/backend/prisma/seed.ts`
- **Moduli:** `apps/backend/src/water-system-*/`
- **PrismaLegacy:** `apps/backend/src/prisma-legacy/`

### Frontend:
- **Pages:** `apps/admin-portal/src/pages/`
- **CSV utils:** `apps/admin-portal/src/utils/csv.ts`
- **API client:** `apps/admin-portal/src/services/api.ts`

---

## 🔥 Quick Reference

### Kada nešto ne radi:

**403 Forbidden:**
- Provjeri da li su permisije dodate u seed.ts
- Pokreni `npx prisma db seed`
- Odjavi se i prijavi ponovo

**SearchList prazan:**
- Dodaj `fetchOnRender={true}`
- Proveri backend endpoint `/search-list`

**CSV ne radi:**
- Provjeri putanje (mora `/api/...`)
- Koristi `exportCSV()` i `importCSV()` iz utils

**TypeScript greška:**
- Provjeri importovanje api instance
- Provjeri tipove (DTO vs Entity)

---

## 🎓 Uspešno migrirane stranice

### ✅ Gradovi/Naselja (Cities)
- Backend: `water-system-cities/`
- Frontend: `WaterSystemCitiesPage.tsx`
- Jednostavna forma, CSV ✅

### ✅ Ulice (Streets)
- Backend: `water-system-streets/`
- Frontend: `WaterSystemStreetsPage.tsx`
- Lookup polja: Grad, Rejon
- CSV ✅

---

## 💡 Saveti

1. **Kopiraj postojeće stranice** kao template (Cities ili Streets)
2. **Pročitaj stari PHP kod** da razumeš logiku
3. **Prvo implementiraj backend**, pa onda frontend
4. **Testiraj postepeno** - ne sve odjednom
5. **Uvek dodaj SUPER_ADMIN permisije odmah**, ne na kraju

---

**Poslednje ažuriranje:** 2025-01-10
