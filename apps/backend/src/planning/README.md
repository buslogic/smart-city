# 📅 Raspored - Dokumentacija funkcije

**URL:** `/transport/planning/schedule`
**Naziv:** Raspored
**Modul:** Dispečerski → Planiranje
**Kreiran:** 2025-10-22

---

## 🎯 Suština funkcije

**Raspored** omogućava planiranje dnevnog rada vozača na linijama gradskog prevoza. Sistem dodeljuje vozače na specifične **turnuse** (turaže) i **smene** za odabrani datum.

### Ključni koncept:
Kada se kreira raspored za jedan turnus/smenu:
- Backend pronalazi **SVE polaske** iz tog turnusa/smene
- Kreira **JEDAN zapis u `date_travel_order`** ZA SVAKI polazak
- Sinhronizuje sa **legacy `date_shedule`** tabelom (dual-write)

**Primer:** Turnus 00018-1 smena 1 ima 45 polazaka → kreira se 45 zapisa!

---

## 📁 Frontend struktura

### 1. Glavne komponente

#### `/apps/admin-portal/src/pages/transport/planning/Schedule.tsx` (625 linija)
**Glavna stranica** sa formom i tabelom rasporeda.

**Ključni state:**
- `selectedDate` - datum za koji se pravi raspored
- `selectedLine` - izabrana linija
- `selectedTurnus` - izabrani turnus sa svim smenama
- `selectedShift` - izabrana smena (1, 2 ili 3)
- `selectedDriver` - izabrani vozač
- `schedules` - lista svih rasporeda za datum

**Ključne funkcije:**
- `loadTurnusi()` - učitava turnuse po liniji i datumu (dan u nedelji)
- `handleSubmit()` - kreira raspored i radi **smart form reset**
- `loadSchedules()` - učitava rasporede za datum (grupisane po turnus/smena)
- `handleDelete()` - briše SVE polaske za turnus/smena

**Smart form reset logika:**
```typescript
// Posle dodavanja rasporeda:
// 1. Ako ima još smena u trenutnom turnusu → postavi sledeću smenu
// 2. Ako nema → pronađi prvi NEPOPUNJENI turnus
// 3. Ako nema nepopunjenih → resetuj formu
```

#### `/apps/admin-portal/src/pages/transport/planning/components/DriverSelectionModal.tsx` (262 linije)
**Fullscreen modal** za izbor vozača sa sistemom filtera.

**Ključne funkcionalnosti:**
- Inicijalno učitava **samo preporučene vozače** (brže)
- Dugme "Prikaži sve vozače" (bez filtera)
- Search po imenu vozača
- Filteri za slobodne/zauzete vozače
- Prikazuje **confidence score** (preporuka)

**API poziv:**
```typescript
planningService.getDriversAvailability({
  date, lineNumber, turnusId, shiftNumber,
  onlyRecommended: true  // ili false za sve
})
```

### 2. Frontend servis

#### `/apps/admin-portal/src/services/planning.service.ts`

**Interfejsi:**
```typescript
interface Line {
  id, lineNumberForDisplay, lineTitle, label, value
}

interface Turnus {
  turnusId: number;         // Prvi ID (za kompatibilnost)
  turnusIds: number[];      // SVE ID-eve za ovaj turnus! (VAŽNO)
  turnusName: string;       // Grupa po ovom (ne po ID-u!)
  shifts: number[];         // [1, 2, 3] ili [1, 2]
  label, value
}

interface Driver {
  id, firstName, lastName, fullName, label, value
}

interface Schedule {
  id, date, lineNumber, lineName,
  turnusId, turnusName, shiftNumber,
  turageNo, departureNoInTurage,
  turnusStartTime, turnusDuration,  // formatiran string: "04:00 - 23:15 (19:15)"
  departuresCount,                  // broj polazaka
  driverId, driverName
}
```

**API metode:**
- `getLines()` → GET `/api/planning/lines`
- `getTurnusi(lineNumber, date)` → GET `/api/planning/turnusi`
- `getDrivers()` → GET `/api/planning/drivers`
- `getDriversAvailability(params)` → GET `/api/planning/drivers-availability`
- `createSchedule(dto)` → POST `/api/planning/schedule`
- `getSchedule(date)` → GET `/api/planning/schedule?date=`
- `getMonthlySchedules(month, year, lineNumber)` → GET `/api/planning/schedule/monthly`
- `deleteSchedule(id, startDate)` → DELETE `/api/planning/schedule/:id/:startDate`
- `deleteMonthlySchedule(id, startDate, params)` → DELETE `/api/planning/schedule/monthly/:id/:startDate`

---

### 3. Tab "Mesečni" - Pregled i brisanje rasporeda

#### `/apps/admin-portal/src/pages/transport/planning/components/MonthlyScheduleForm.tsx`
**Komponenta za prikaz i upravljanje rasporedima za ceo mesec.**

**Ključni state:**
- `selectedMonth` - izabrani mesec (dayjs objekat)
- `selectedLine` - izabrana linija
- `monthlySchedules` - svi rasporedi za mesec/liniju
- `filteredSchedules` - filtrirani rasporedi za prikaz
- `filterDate` - filter po datumu
- `filterTurnus` - filter po turnusu
- `filterDriver` - filter po vozaču
- `deleteModalVisible` - vidljivost delete modal-a
- `scheduleToDelete` - raspored koji se briše

**Ključne funkcije:**
- `loadMonthlySchedules()` - učitava sve rasporede za mesec/liniju
- `extractUniqueTurnusi()` - ekstraktuje jedinstvene turnuse za filter
- `extractUniqueDrivers()` - ekstraktuje jedinstvene vozače za filter
- `extractUniqueDates()` - ekstraktuje jedinstvene datume za filter
- `applyFilters()` - primenjuje frontend filtere
- `handleDeleteClick()` - otvara delete modal
- `handleDeleteConfirm()` - briše raspored (dan ili mesec)

**Tabela sa filterima:**
```
╔════════════════════════════════════════════════════════════════╗
║ Filteri:  [Datum ▼] [Turnus ▼] [Vozač ▼]                       ║
╠════════════════════════════════════════════════════════════════╣
║ Datum          | Linija | Turnus  | Smena | Trajanje  | Polasci | Vozač       | Akcije ║
╠════════════════════════════════════════════════════════════════╣
║ Sre, 01.11.2025| 18     | 00018-1 | 1     | 04:00-    | 45      | M. Marković | [Obriši] ║
║                |        |         |       | 23:15     |         |             |          ║
╚════════════════════════════════════════════════════════════════╝
```

#### `/apps/admin-portal/src/pages/transport/planning/components/DeleteScheduleModal.tsx`
**Custom modal za brisanje rasporeda sa dve opcije.**

**Opcije brisanja:**
1. **"Obriši samo za ovaj dan"** (default)
   - Briše SVE polaske za odabrani turnus/smenu samo za taj dan
   - Prikazuje: datum, liniju, turnus, smenu, vozača

2. **"Obriši za ceo mesec (isti turnus i smena)"**
   - Briše SVE polaske za odabrani turnus/smenu za SVE dane u mesecu
   - Prikazuje upozorenje (crveni okvir)
   - Poruka: "Ova akcija će obrisati sve rasporede za odabrani turnus i smenu u celom mesecu. Akcija se ne može poništiti."

**Radio button UX:**
```
╔═══════════════════════════════════════════════════════╗
║ 🛈 Potvrda brisanja rasporeda                         ║
╠═══════════════════════════════════════════════════════╣
║ Datum: Sreda, 01. novembar 2025.                      ║
║ Linija: 18 - Zvezdara - Banovo brdo                   ║
║ Turaža: 00018-1                                       ║
║ Smena: Prva smena                                     ║
║ Vozač: Marko Marković                                 ║
╠═══════════════════════════════════════════════════════╣
║ Izaberite opseg brisanja:                             ║
║                                                       ║
║ ⦿ Obriši samo za ovaj dan                            ║
║   Brisaće se raspored samo za Sreda, 01. novembar... ║
║                                                       ║
║ ○ Obriši za ceo mesec (isti turnus i smena)          ║
║   Brisaće se svi rasporedi za turnus 00018-1,        ║
║   Prva smena u mesecu Novembar 2025.                 ║
╠═══════════════════════════════════════════════════════╣
║ ⚠️ Upozorenje: Ova akcija će obrisati sve rasporede  ║
║    za odabrani turnus i smenu u celom mesecu.        ║
║    Akcija se ne može poništiti.                      ║
╚═══════════════════════════════════════════════════════╝
        [Otkaži]  [Potvrdi brisanje (crveno)]
```

---

## 🔧 Backend struktura

### 1. Kontroler

#### `/apps/backend/src/planning/planning.controller.ts` (154 linije)

**Endpointi:**

| Metod | Endpoint | Permisija | Opis |
|-------|----------|-----------|------|
| GET | `/planning/lines` | `transport.planning.schedule:view` | Sve aktivne linije |
| GET | `/planning/turnusi?lineNumber&date` | `transport.planning.schedule:view` | Turnusi po liniji i datumu |
| GET | `/planning/drivers` | `transport.planning.schedule:view` | Svi vozači |
| GET | `/planning/drivers-availability?date&lineNumber&turnusId&shiftNumber` | `transport.planning.schedule:view` | Dostupnost vozača |
| POST | `/planning/schedule` | `transport.planning.schedule:create` | Kreiraj raspored |
| GET | `/planning/schedule?date` | `transport.planning.schedule:view` | Rasporedi za datum |
| GET | `/planning/schedule/monthly?month&year&lineNumber` | `transport.planning.schedule:view` | Rasporedi za mesec/liniju |
| DELETE | `/planning/schedule/:id/:startDate` | `transport.planning.schedule:delete` | Obriši raspored |
| DELETE | `/planning/schedule/monthly/:id/:startDate` | `transport.planning.schedule:delete` | Obriši mesečni raspored |

### 2. Servis

#### `/apps/backend/src/planning/planning.service.ts` (1341 linija!)

**Ključne metode:**

#### `getLines()` - Linija 14-44
```typescript
// GROUP BY line_number_for_display (eliminiše duplikate - smerovi, varijante)
// Filteruje:
// - l.status = 'A'
// - ptg.status = 'A' AND synchro_status = 'A'
// ORDER BY numericko sortiranje
```

#### `getTurnusiByLineAndDate(lineNumber, date)` - Linija 49-137
**Najkompleksniji query!**

```typescript
// 1. Izračunaj dan u nedelji iz datuma (getDayNameFromDate)
// 2. Pronađi line.lineNumber (NE lineNumberForDisplay!)
// 3. Query sa JOIN-ovima:
//    - changes_codes_tours (turnusi)
//    - turnus_days (dani saobraćanja)
//    - lines (aktivne linije)
//    - price_variations (varijacije cena)
//    - price_table_groups (grupe važenja)
// 4. Filteri:
//    - l.status = 'A'
//    - ptg.status = 'A' AND synchro_status = 'A'
//    - td.dayname = izračunati dan
//    - price_variation_id provera datuma
// 5. Grupisanje po turnusName (NE turnusId!)
//    - Isti turnus ima više ID-eva (aktivne/neaktivne linije)
//    - turnusIds: number[] - lista svih ID-eva
```

#### `getDrivers()` - Linija 142-166
```typescript
// User WHERE userGroup.driver = true AND isActive = true
// ORDER BY lastName, firstName
```

#### `getDriversAvailability(dto)` - Linija 172-398
**Najkompleksnija metoda! (226 linija)**

**Logika:**
```typescript
// 1. Ako onlyRecommended=true:
//    - Dobavi vozače iz turnus_default_per_driver
//    - Filtriraj po priority/confidence_score
//    - Ako nema preporučenih → vrati []

// 2. Dobavi vozače (sve ili samo preporučene)

// 3. Za svaki vozač:
//    - Pronađi SVE isplanirane polaske za taj dan (date_travel_order)
//    - Grupiši po turnus/smena
//    - Izračunaj startTime, endTime, duration ZA SVAKU SMENU

// 4. Dobavi defaults iz turnus_default_per_driver:
//    - Match nivoi (priority):
//      Level 1: smena + dan (najprecizniji)
//      Level 2: smena + bilo koji dan
//      Level 3: bilo koja smena + dan
//      Level 4: samo turnus (fallback)

// 5. Dodaj turnusDefault podatke svakom vozaču:
//    - hasDefault, usageCount, usagePercentage
//    - confidenceScore, priority, note

// 6. Sortiraj vozače po confidenceScore DESC

// 7. Vrati requestedShift info (za prikaz u modal-u)
```

#### `createSchedule(dto, userId)` - Linija 403-731
**Najdugačija metoda! (328 linija)**

**Ključni koraci:**
```typescript
// 1. Validacija: pronađi liniju, turnus, vozača

// 2. Pronađi NAJNOVIJI turnus_id sa MAX(change_time):
//    - MORA JOIN sa lines i filtrirati status='A'
//    - MORA JOIN sa turnus_days za dan u nedelji
//    - Ovo izbegava neaktivne linije!

// 3. Dobavi SVE polaske za turnus/smenu:
//    - WHERE turnus_id = najnoviji
//    - WHERE shift_number = odabrana smena
//    - WHERE direction = 0 (eliminiše duplikate - smer A i B)
//    - Primeni ISTE filtere kao getTurnusiByLineAndDate:
//      * l.status = 'A'
//      * ptg.status = 'A' AND synchro_status = 'A'
//      * price_variations provera datuma

// 4. Za SVAKI polazak (allDepartures):
//    - Izračunaj endTime (startTime + duration)
//    - Kreiraj zapis u date_travel_order sa SVIM poljima
//    - comment: "Turnus: {name}, Smena: {no}, Polazak: {i}/{total}"
//    - sheduleId = turnusId (za povezivanje)

// 5. Sinhronizuj sa legacy date_shedule tabelom:
//    - syncToLegacySchedule() - dual-write strategija
//    - Koristi driver.legacyId za user_1_id_planned
//    - Dobavi start/end station imena iz price_lists_line_uids_*

// 6. Vrati sumarno:
//    - departuresCount (npr. 45 polazaka)
//    - firstDepartureTime, lastDepartureTime
```

#### `getSchedulesByDate(date)` - Linija 737-910
**Grupisanje polazaka za prikaz!**

```typescript
// 1. Dobavi SVE date_travel_order za datum

// 2. Grupiši po: lineNo + turnusName + shiftNumber + driverId
//    - Ekstraktuj turnusName i shiftNumber iz comment polja
//    - Map<groupKey, GroupedSchedule>

// 3. Za svaku grupu:
//    - Izračunaj ukupno trajanje (prvi do poslednji polazak)
//    - Formatuj vreme: "04:00 - 23:15 (19:15)"
//    - Ako durationMinutes < 0 → dodaj 24h (prelazi ponoć!)
//    - Dobavi turage_no iz changes_codes_tours

// 4. Natural sort po: linija → turnus → smena
```

#### `deleteSchedule(id, startDate)` - Linija 936-981
**Briše SVE polaske!**

```typescript
// 1. Pronađi prvi zapis po id + startDate

// 2. Ekstraktuj turnusName i shiftNumber iz comment

// 3. Obriši SVE date_travel_order WHERE:
//    - startDate = isti datum
//    - lineNo = ista linija
//    - driverId = isti vozač
//    - comment CONTAINS "Turnus: {name}, Smena: {no}"

// 4. Obriši iz legacy date_shedule (deleteFromLegacySchedule)
```

#### `getMonthlySchedulesByLine(query)` - Linija 939-969
**Dobavi sve rasporede za mesec i liniju**

```typescript
// 1. Generiši sve datume u mesecu (getAllDatesInMonth)
const allDates = [Date(2025-11-01), Date(2025-11-02), ..., Date(2025-11-30)]

// 2. Za svaki datum dobavi rasporede (getSchedulesByDate)
for (date of allDates) {
  const schedulesForDate = await getSchedulesByDate(date)
  const filtered = schedulesForDate.filter(s => s.lineNumber === query.lineNumber)
  allSchedules.push(...filtered)
}

// 3. Sortiraj po datum → turnus → smena
return allSchedules.sort((a, b) => {
  // 1. Po datumu
  const dateCompare = new Date(a.date) - new Date(b.date)
  if (dateCompare !== 0) return dateCompare

  // 2. Po turnusName (natural sort)
  const turnusCompare = a.turnusName.localeCompare(b.turnusName, undefined, { numeric: true })
  if (turnusCompare !== 0) return turnusCompare

  // 3. Po shiftNumber
  return a.shiftNumber - b.shiftNumber
})
```

**Rezultat:** Lista svih isplaniranih turnusa za odabrani mesec i liniju, grupisanih kao u `getSchedulesByDate()`.

#### `deleteMonthlySchedule(params)` - Linija 1045-1121
**Briše SVE polaske za turnus/smenu u CELOM mesecu!**

```typescript
// 1. Generiši sve datume u mesecu
const allDates = getAllDatesInMonth(params.month, params.year)

// 2. Za svaki datum u mesecu:
for (date of allDates) {
  try {
    // 2.1. Formatiraj datum (izbegni timezone probleme)
    const formattedDate = formatDateForQuery(date)  // "2025-11-01"
    const dateForQuery = new Date(formattedDate)

    // 2.2. Pronađi rasporede za taj datum, liniju, turnus i smenu
    const schedulesForDate = await prisma.dateTravelOrder.findMany({
      where: {
        startDate: dateForQuery,
        lineNo: params.lineNumber,
        comment: { contains: `Turnus: ${params.turnusName}, Smena: ${params.shiftNumber}` }
      }
    })

    // 2.3. Ako postoje rasporedi:
    if (schedulesForDate.length > 0) {
      const driverId = schedulesForDate[0].driverId

      // 2.4. Obriši SVE polaske za taj datum
      await prisma.dateTravelOrder.deleteMany({
        where: {
          startDate: dateForQuery,
          lineNo: params.lineNumber,
          driverId,
          comment: { contains: `Turnus: ${params.turnusName}, Smena: ${params.shiftNumber}` }
        }
      })

      totalDeletedCount += deleteResult.count
      daysDeleted++

      // 2.5. Obriši iz legacy date_shedule
      await deleteFromLegacySchedule({ ... })
    }
  } catch (error) {
    // Loguj grešku ali nastavi sa sledećim datumom
    logger.error(`Greška za datum ${date}:`, error)
  }
}

// 3. Vrati sumarno
return {
  success: true,
  message: `Obrisano ${totalDeletedCount} polazaka za ${daysDeleted} dana`,
  deletedCount: totalDeletedCount,
  daysDeleted
}
```

**Ključne karakteristike:**
- **Datum formatting:** Koristi `formatDateForQuery()` i `new Date(formatted)` da izbegne timezone probleme
- **Error handling:** Catch blok NE blokira petlju - nastavlja sa sledećim datumom
- **Legacy sync:** Za svaki dan poziva `deleteFromLegacySchedule()`
- **Return:** Vraća ukupan broj obrisanih polazaka i broj dana

#### Helper metode:

**`getDayNameFromDate(dateString)` - Linija 915-930**
```typescript
// Konverzija datuma u ime dana:
// 0 = Nedelja, 1 = Ponedeljak, ..., 6 = Subota
```

**`extractShiftFromComment(comment)` - Linija 986-989**
```typescript
// Regex: /Smena: (\d+)/
```

**`extractTurnusNameFromComment(comment)` - Linija 994-997**
```typescript
// Regex: /Turnus: ([^,]+)/
```

**`syncToLegacySchedule()` - Linija 1003-1105**
```typescript
// Za SVAKI polazak insertuj u date_shedule
// INSERT sa SVIM obaveznim NOT NULL poljima
// Koristi driver.legacyId za user_1_id_planned
```

**`deleteFromLegacySchedule()` - Linija 1247-1288**
```typescript
// 1. Prvo dobavi turnus_id iz changes_codes_tours
const turnusResult = await prisma.$queryRawUnsafe(`
  SELECT turnus_id FROM changes_codes_tours
  WHERE turnus_name = ? AND shift_number = ?
  LIMIT 1
`)

// 2. Zatim obriši iz date_shedule direktno (bez LIMIT u subquery-ju)
await prisma.$executeRawUnsafe(`
  DELETE FROM date_shedule
  WHERE line_no = ? AND start_date = ?
    AND user_1_id_planned = ?
    AND tour_id = ?  -- direktna vrednost, ne subquery
`)
```

**Napomena:** Refaktorisano da izbegne MySQL grešku sa LIMIT u subquery-ju.

**`getAllDatesInMonth(month, year)` - Linija 1478-1487**
```typescript
// Generiši niz Date objekata za sve dane u mesecu
const daysInMonth = new Date(year, month, 0).getDate()
for (let day = 1; day <= daysInMonth; day++) {
  dates.push(new Date(year, month - 1, day))
}
// Rezultat: [Date(2025-11-01), Date(2025-11-02), ..., Date(2025-11-30)]
```

**`formatDateForQuery(date)` - Linija 1531-1536**
```typescript
// Formatira Date objekat u 'YYYY-MM-DD' string
const year = date.getFullYear()
const month = (date.getMonth() + 1).toString().padStart(2, '0')
const day = date.getDate().toString().padStart(2, '0')
return `${year}-${month}-${day}`  // "2025-11-01"
```

**`getLineStations()` - Linija 1149-1209**
```typescript
// Dinamički table name: price_lists_line_uids_{YYYY_MM_DD}
// JOIN sa unique_station_id_local
// MIN/MAX station_number za start/end stanicu
```

**`getRequestedShiftInfo()` - Linija 1230-1339**
```typescript
// Pronađi najnoviji turnus_id
// Dobavi SVE polaske za turnus/smenu
// Izračunaj startTime, endTime, duration
// Vrati info o traženoj smeni (za prikaz u modal-u)
```

---

## 🗄️ Baza podataka

### Glavne tabele

#### 1. `date_travel_order` - GLAVNA TABELA ZA RASPORED (Smart City)
**Composite PK:** `(id, start_date)`

**Ključna polja:**
```sql
id                INT (auto_increment)
start_date        DATE                -- datum za koji je planiran polazak
driver_id         INT                 -- ID vozača (FK → users.id)
driver_name       VARCHAR(50)         -- ime i prezime vozača
line_no           VARCHAR(6)          -- broj linije
line_name         VARCHAR(50)         -- naziv linije
start_time        TIME                -- vreme polaska
end_time          TIME                -- vreme dolaska
shedule_id        INT                 -- turnus_id (FK → changes_codes_tours.turnus_id)
comment           TEXT                -- "Turnus: {name}, Smena: {no}, Polazak: {i}/{total}"
planned           TINYINT(1)          -- 1 = planirano, 0 = realizovano
realised          TINYINT(1)          -- 0 = nije realizovano
```

**Indeksi:**
- PRIMARY KEY (id, start_date)
- INDEX (start_date)
- INDEX (driver_id)
- INDEX (shedule_id)

**Napomena:** Svaki polazak u turnusu/smeni je POSEBAN zapis!

---

#### 2. `date_shedule` - LEGACY TABELA (BGNaplata ticketing sistem)
**Napomena:** Sync-uje se sa date_travel_order (dual-write)!

**Ključna polja:**
```sql
id                  INT (auto_increment)
start_date          DATE
start_time          TIME
end_time            TIME
line_no             VARCHAR(6)
line_name           VARCHAR(50)
start_station       VARCHAR(50)
end_station         VARCHAR(50)
user_1_id_planned   INT               -- driver.legacyId (NE driver.id!)
tour_id             INT               -- turnus_id
turnus_departure_no INT               -- departure_number
direction           TINYINT
```

**Sync strategija:**
- `syncToLegacySchedule()` - INSERT za svaki polazak
- `deleteFromLegacySchedule()` - DELETE po kriterijumima

---

#### 3. `changes_codes_tours` - TURNUSI I POLASCI (red vožnje)
**Osnovne informacije o svakom polasku u turnusu.**

**Ključna polja:**
```sql
id                      INT (auto_increment)
turnus_id               MEDIUMINT UNSIGNED    -- ID turnusa
turnus_name             VARCHAR(320)          -- ime turnusa (npr. "00018-1")
line_no                 VARCHAR(6)            -- broj linije
start_time              TIME                  -- vreme polaska
duration                TIME                  -- trajanje vožnje
direction               TINYINT               -- 0 = smer A, 1 = smer B
shift_number            TINYINT               -- smena (1, 2, 3)
departure_number        SMALLINT              -- redni broj polaska u turnusu
departure_no_in_turage  TINYINT               -- redni broj u turaži
turage_no               TINYINT               -- broj turaže
active                  TINYINT               -- aktivnost
change_time             DATETIME              -- vreme poslednje izmene (KLJUČNO!)
change_code             TINYINT               -- kod promene
line_type_id            INT                   -- tip linije
```

**Indeksi:**
- PRIMARY KEY (id)
- INDEX (turnus_id)
- INDEX (turnus_id, turnus_name)
- INDEX (line_no, direction, start_time)

**⚠️ VAŽNO:**
- **Isti turnus ima više ID-eva** (aktivne/neaktivne linije)
- **Grupisanje po `turnus_name`**, NE po `turnus_id`!
- **Najnoviji turnus:** MAX(change_time) za aktuelne podatke
- **Direction = 0** za eliminaciju duplikata (smer A i B)

---

#### 4. `turnus_days` - DANI SAOBRAĆANJA TURNUSA
**Definiše u koje dane nedeljno saobraća turnus.**

**Polja:**
```sql
turnus_id    MEDIUMINT UNSIGNED
dayname      ENUM('Ponedeljak','Utorak','Sreda','Četvrtak','Petak','Subota','Nedelja')
```

**Indeksi:**
- INDEX (turnus_id)
- INDEX (dayname)

**Primer:** Turnus 274206 saobraća Ponedeljak, Utorak, Sreda...

---

#### 5. `lines` - LINIJE
**Definicija svake linije.**

**Ključna polja:**
```sql
id                       INT (auto_increment)
line_number              VARCHAR(6)             -- pravi broj linije
line_number_for_display  VARCHAR(6)             -- broj za prikaz (grupisanje!)
line_title               VARCHAR(50)            -- naziv linije
line_type                VARCHAR(30)            -- tip (gradska, prigradska)
status                   ENUM('A','N')          -- A = aktivna, N = neaktivna
date_valid_from          DATE                   -- datum važenja
price_variation_id       INT                    -- varijacija cena
legacy_ticketing_id      INT                    -- ID u legacy ticketing sistemu
```

**Indeksi:**
- PRIMARY KEY (id)
- INDEX (line_number)
- INDEX (line_number_for_display)
- INDEX (status)
- INDEX (date_valid_from)

**⚠️ VAŽNO:**
- **line_number** - koristi se za povezivanje sa changes_codes_tours
- **line_number_for_display** - koristi se za prikaz i filtriranje (eliminiše duplikate - smerovi, varijante)
- **Ista linija može imati više zapisa** (različiti date_valid_from, varijante, smerovi)
- **JOIN sa price_table_groups** preko date_valid_from!

---

#### 6. `price_table_groups` - GRUPE VAŽENJA CENOVNIKA
**Grupe koje definišu važenje cenovnika.**

**Polja:**
```sql
id                INT (auto_increment)
date_valid_from   DATE                -- datum važenja
status            ENUM('A','N')       -- A = aktivna
synchro_status    ENUM('A','N')       -- A = sinhronizovana
```

**Indeksi:**
- PRIMARY KEY (id)
- UNIQUE (date_valid_from)
- INDEX (status)

**⚠️ VAŽNO:**
- **JOIN sa lines** preko date_valid_from
- **Filteri:** status = 'A' AND synchro_status = 'A'

---

#### 7. `price_variations` - VARIJACIJE CENA
**Definišu periode varijacija cena (npr. letnji raspored).**

**Polja:**
```sql
id              INT (auto_increment)
datetime_from   DATETIME
datetime_to     DATETIME
description     VARCHAR(255)
```

**Indeksi:**
- PRIMARY KEY (id)

**Provera:** `DATE(date) BETWEEN DATE(datetime_from) AND DATE(datetime_to)`

---

#### 8. `turnus_default_per_driver` - PREPORUČENI VOZAČI ZA TURNUS
**Tabela za pamćenje ko obično vozi koji turnus.**

**Polja:**
```sql
id                INT (auto_increment)
turnus_name       VARCHAR(320)        -- ime turnusa
shift_number      TINYINT             -- smena (NULL = sve smene)
day_of_week       ENUM(...)           -- dan (NULL = svi dani)
driver_id         INT                 -- ID vozača
usage_count       INT                 -- koliko puta korišćeno
usage_percentage  DECIMAL(5,2)        -- procenat korišćenja
confidence_score  DECIMAL(5,2)        -- nivo pouzdanosti (0-100)
priority          INT                 -- prioritet (1 = najviši)
note              TEXT                -- napomena
is_active         BOOLEAN             -- da li je aktivan default
auto_generated    BOOLEAN             -- generisan automatski
```

**Match nivoi (priority):**
```
1 = smena + dan (najprecizniji)
2 = smena + bilo koji dan
3 = bilo koja smena + dan
4 = samo turnus (fallback)
```

**Indeksi:**
- INDEX (turnus_name, shift_number, day_of_week, driver_id)
- INDEX (driver_id)
- INDEX (is_active)
- INDEX (auto_generated, confidence_score)

---

#### 9. `users` - KORISNICI (VOZAČI)
**Tabela korisnika sa flagom za vozače.**

**Ključna polja:**
```sql
id           INT (auto_increment)
email        VARCHAR(255)
first_name   VARCHAR(50)
last_name    VARCHAR(50)
legacy_id    INT                 -- ID u legacy sistemu (za date_shedule sync!)
is_active    BOOLEAN
user_group_id INT                -- FK → user_groups.id
```

**Join sa user_groups:**
```sql
JOIN user_groups ON users.user_group_id = user_groups.id
WHERE user_groups.driver = true  -- filtriranje vozača
```

---

### Relacije između tabela

```
date_travel_order
├── driver_id → users.id
├── shedule_id → changes_codes_tours.turnus_id
└── start_date + line_no → grupisanje

changes_codes_tours
├── turnus_id → turnus_days.turnus_id
├── line_no → lines.line_number
└── turnus_name → turnus_default_per_driver.turnus_name

lines
├── date_valid_from → price_table_groups.date_valid_from
├── price_variation_id → price_variations.id
└── legacy_ticketing_id → price_lists_line_uids_*.price_tables_index_id

turnus_default_per_driver
├── driver_id → users.id
└── turnus_name → changes_codes_tours.turnus_name

date_shedule (legacy)
├── user_1_id_planned → users.legacy_id (NE id!)
└── tour_id → changes_codes_tours.turnus_id
```

---

## 🧠 Biznis logika

### 1. Kreiranje rasporeda - Korak po korak

**1.1 Korisnik bira:**
```
Datum: 2025-10-22 (Sreda)
Linija: 18
Turnus: 00018-1
Smena: 1 (Prva smena)
Vozač: Marko Marković
```

**1.2 Backend proces:**
```typescript
// KORAK 1: Validacija
- Pronađi liniju po lineNumberForDisplay: "18"
- Pronađi turnus po turnusName: "00018-1"
- Pronađi vozača po id

// KORAK 2: Izračunaj dan u nedelji
const dayName = "Sreda"  // iz datuma 2025-10-22

// KORAK 3: Pronađi NAJNOVIJI turnus_id
// Query sa MAX(change_time):
SELECT turnus_id FROM changes_codes_tours
WHERE turnus_name = '00018-1'
  AND shift_number = 1
  AND direction = 0
  AND EXISTS (SELECT 1 FROM turnus_days WHERE turnus_id = cct.turnus_id AND dayname = 'Sreda')
  AND EXISTS (SELECT 1 FROM lines WHERE line_number = cct.line_no AND status = 'A')
GROUP BY turnus_id
ORDER BY MAX(change_time) DESC
LIMIT 1
-- Rezultat: turnus_id = 274206 (najnoviji)

// KORAK 4: Dobavi SVE polaske
SELECT * FROM changes_codes_tours
WHERE turnus_id = 274206
  AND shift_number = 1
  AND direction = 0
ORDER BY start_time ASC
-- Rezultat: 45 polazaka (npr.)

// KORAK 5: Kreiraj zapise u date_travel_order
for (i = 0; i < 45; i++) {
  INSERT INTO date_travel_order (
    start_date: '2025-10-22',
    driver_id: 15,
    driver_name: 'Marko Marković',
    line_no: '18',
    line_name: 'Zvezdara - Banovo brdo',
    start_time: polazak[i].start_time,
    end_time: startTime + duration,
    shedule_id: 274206,
    comment: 'Turnus: 00018-1, Smena: 1, Polazak: 1/45',
    planned: 1,
    realised: 0,
    ...
  )
}

// KORAK 6: Sync sa legacy date_shedule
for (i = 0; i < 45; i++) {
  INSERT INTO date_shedule (
    line_no: '18',
    start_date: '2025-10-22',
    user_1_id_planned: vozac.legacyId,  // NE id!
    tour_id: 274206,
    ...
  )
}
```

**1.3 Rezultat:**
- **45 zapisa** u `date_travel_order`
- **45 zapisa** u `date_shedule` (legacy)
- **Vreme izvršavanja:** ~2-5 sekundi

---

### 2. Smart form reset

**Scenario:** Korisnik dodaje raspored za turnus koji ima 3 smene.

```typescript
// Trenutni state:
selectedTurnus = "00018-1"  // ima smene: [1, 2, 3]
selectedShift = "1"

// Korisnik dodaje raspored (klik na "Dodaj")
handleSubmit()

// Smart reset logika:
const currentShift = 1
const availableShifts = [1, 2, 3]
const currentIndex = 0  // indexOf(1) u [1, 2, 3]

// Provera: Da li ima sledeće smene?
if (currentIndex < availableShifts.length - 1) {
  // DA! Postavi sledeću smenu
  setSelectedShift(2)  // "Druga smena"
  message.info('Automatski prebačeno na sledeću smenu')

} else {
  // NE! Nema više smena u ovom turnusu

  // Pronađi sledeći NEPOPUNJENI turnus
  const remainingTurnusi = turnusi.slice(currentTurnusIndex + 1)
  const firstUnfilled = remainingTurnusi.find(turnus => {
    const existingSchedules = schedules.filter(s =>
      s.turnusName === turnus.turnusName && s.lineNumber === selectedLine
    )
    return existingSchedules.length < turnus.shifts.length
  })

  if (firstUnfilled) {
    // Postoji nepopunjeni turnus!
    setSelectedTurnus(firstUnfilled)
    setSelectedShift(firstUnfilled.shifts[0])  // prva smena
    message.info(`Automatski prebačeno na ${firstUnfilled.label}`)
  } else {
    // Nema više nepopunjenih turnusa
    setSelectedTurnus(null)
    setSelectedShift('')
    message.info('Završeno sa svim turnusima za ovu liniju')
  }
}

// Vozača uvek resetuj
setSelectedDriver(null)
```

**Primer toka:**
```
Korisnik dodaje:
1. Turnus 00018-1, Smena 1 → automatski prelazi na Smena 2
2. Turnus 00018-1, Smena 2 → automatski prelazi na Smena 3
3. Turnus 00018-1, Smena 3 → automatski prelazi na Turnus 00018-2, Smena 1
4. Turnus 00018-2, Smena 1 → automatski prelazi na Smena 2
...
N. Poslednji turnus, Smena 3 → resetuje formu (sve završeno)
```

---

### 3. Dostupnost vozača i preporuke

**3.1 Preporuke (turnus_default_per_driver)**

Kada korisnik otvori modal za izbor vozača, backend:

```typescript
// 1. Pronađi preporučene vozače za ovaj turnus/smenu/dan
const recommendedDrivers = await prisma.turnus_default_per_driver.findMany({
  where: {
    turnusName: "00018-1",
    isActive: true,
    OR: [
      { shiftNumber: 1, dayOfWeek: 'Sreda' },      // Level 1 - najprecizniji
      { shiftNumber: 1, dayOfWeek: null },         // Level 2 - smena + bilo koji dan
      { shiftNumber: null, dayOfWeek: 'Sreda' },   // Level 3 - bilo koja smena + dan
      { shiftNumber: null, dayOfWeek: null },      // Level 4 - fallback
    ]
  },
  orderBy: [
    { priority: 'asc' },           // 1 = najprecizniji
    { confidenceScore: 'desc' },   // veći = bolji
    { usageCount: 'desc' }         // više korišćenja
  ]
})

// 2. Za svakog vozača iz liste, proveri dostupnost
for (driver of recommendedDrivers) {
  // Pronađi sve isplanirane polaske za taj dan
  const schedules = await prisma.dateTravelOrder.findMany({
    where: { startDate: '2025-10-22', driverId: driver.id }
  })

  // Grupiši po turnus/smena
  const scheduledShifts = groupByTurnusShift(schedules)

  // Dodaj default info
  driver.turnusDefault = {
    hasDefault: true,
    usageCount: 45,
    usagePercentage: 75.5,
    confidenceScore: 92.3,
    priority: 1,
    note: 'Preporučen vozač - često vozi ovaj turnus'
  }
}

// 3. Sortiraj po confidenceScore DESC
recommendedDrivers.sort((a, b) => b.confidenceScore - a.confidenceScore)

// 4. Vrati requestedShift info
const requestedShift = {
  startTime: "04:00",
  endTime: "23:15",
  duration: "19:15",
  turnusName: "00018-1",
  shiftNumber: 1,
  lineNumber: "18"
}

return { drivers: recommendedDrivers, requestedShift }
```

**3.2 Frontend filteri**

DriverSelectionModal automatski filtrira vozače:

```typescript
// Slobodni vozači (zeleni badge)
freeDrivers = drivers.filter(driver => {
  // Nema NIJEDNU isplaniranu smenu za taj dan
  return driver.scheduledShifts.length === 0
})

// Zauzeti vozači (crveni badge)
busyDrivers = drivers.filter(driver => {
  // Ima BAR JEDNU isplaniranu smenu
  return driver.scheduledShifts.length > 0
})

// Dodatni filteri (opciono):
// - Conflict filter: vremenska preklapanja sa traže nom smenom
// - Same turnus filter: već vozi DRUGI turnus na istoj liniji
```

**3.3 Prikaz u modal-u:**
```
╔═══════════════════════════════════════════╗
║ Slobodni vozači (5)               [75%]   ║
╠═══════════════════════════════════════════╣
║ 🟢 Marko Marković                         ║
║    💡 Confidence: 92.3% (45x korišćeno)   ║
║    📝 Preporučen vozač - često vozi...    ║
╠═══════════════════════════════════════════╣
║ 🟢 Petar Petrović                         ║
║    💡 Confidence: 78.5% (32x korišćeno)   ║
╚═══════════════════════════════════════════╝

╔═══════════════════════════════════════════╗
║ Zauzeti vozači (12)               [25%]   ║
╠═══════════════════════════════════════════╣
║ 🔴 Jovan Jovanović                        ║
║    ⚠️ Već planiran:                       ║
║    • Linija 7, Turnus 00007-2, Smena 1    ║
║      08:00 - 16:30 (08:30)                ║
╚═══════════════════════════════════════════╝
```

---

### 4. Natural sort za turnuse

**Problem:** Standardno sortiranje daje:
```
00018-1
00018-10   ← pogrešan redosled!
00018-2
00018-3
```

**Rešenje:** Natural sort

```typescript
const naturalSort = (a: string, b: string): number => {
  const regex = /(\d+)|(\D+)/g;
  const aParts = a.match(regex) || [];
  const bParts = b.match(regex) || [];

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';

    // Ako su oba dela brojevi, uporedi numerički
    if (!isNaN(Number(aPart)) && !isNaN(Number(bPart))) {
      const diff = Number(aPart) - Number(bPart);
      if (diff !== 0) return diff;
    } else {
      // Inače uporedi kao stringove
      if (aPart !== bPart) return aPart.localeCompare(bPart);
    }
  }

  return 0;
};

// Rezultat:
turnusi.sort((a, b) => naturalSort(a.label, b.label))
// 00018-1
// 00018-2
// 00018-3
// ...
// 00018-10  ← ispravan redosled!
```

---

### 5. Prikaz rasporeda za datum

**Backend grupisanje:**
```typescript
// Dobavi SVE date_travel_order za datum
const schedules = await prisma.dateTravelOrder.findMany({
  where: { startDate: '2025-10-22' }
})
// Rezultat: 450 zapisa (npr. 10 vozača x 45 polazaka prosek)

// Grupiši po: lineNo + turnusName + shiftNumber + driverId
const groupedSchedules = new Map()

for (schedule of schedules) {
  // Ekstraktuj iz comment: "Turnus: 00018-1, Smena: 1, Polazak: 1/45"
  const turnusName = extractTurnusNameFromComment(schedule.comment)  // "00018-1"
  const shiftNumber = extractShiftFromComment(schedule.comment)      // 1

  const groupKey = `${schedule.lineNo}_${turnusName}_${shiftNumber}_${schedule.driverId}`
  // Primer: "18_00018-1_1_15"

  if (!groupedSchedules.has(groupKey)) {
    groupedSchedules.set(groupKey, {
      id: schedule.id,
      lineNumber: schedule.lineNo,
      turnusName,
      shiftNumber,
      driverId: schedule.driverId,
      departures: [schedule]  // prvi polazak
    })
  } else {
    // Dodaj polazak u postojeću grupu
    groupedSchedules.get(groupKey).departures.push(schedule)
  }
}

// Za svaku grupu izračunaj ukupno trajanje
for (group of groupedSchedules.values()) {
  const firstDeparture = group.departures[0]
  const lastDeparture = group.departures[group.departures.length - 1]

  // Format: "04:00 - 23:15 (19:15)"
  const timeDisplay = `${formatTime(firstDeparture.startTime)} - ${formatTime(lastDeparture.endTime)} (${calculateDuration(firstDeparture, lastDeparture)})`

  group.turnusDuration = timeDisplay
  group.departuresCount = group.departures.length
}

// Vrati 10 grupisanih zapisa umesto 450 pojedinačnih
```

**Frontend prikaz:**
```
╔══════════════════════════════════════════════════════════════════╗
║ Datum       | Linija | Turaža   | Smena | Vreme          | Polazaka | Vozač          ║
╠══════════════════════════════════════════════════════════════════╣
║ 22.10.2025  | 18     | 00018-1  | 1     | 04:00-23:15    | 45       | Marko Marković ║
║                                          | (19:15)        |          |                ║
╠══════════════════════════════════════════════════════════════════╣
║ 22.10.2025  | 18     | 00018-1  | 2     | 05:30-01:45    | 42       | Petar Petrović ║
║                                          | (20:15)        |          |                ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## ⚠️ Posebnosti i "gotchas"

### 1. MySQL TIME polja vraćaju Date objekte u UTC

**Problem:**
```typescript
// MySQL TIME: 04:00:00
const startTime = await prisma.dateTravelOrder.findUnique(...)
console.log(startTime.startTime)
// Output: 1970-01-01T04:00:00.000Z  (Date objekat!)
```

**Rešenje:** UVEK koristi `getUTCHours()` i `getUTCMinutes()`

```typescript
// ❌ POGREŠNO - timezone konverzija!
const hours = startTime.getHours()  // Može biti 5, 6... zavisi od timezone-a

// ✅ ISPRAVNO - bez timezone konverzije
const hours = startTime.getUTCHours()  // 4 (kao u bazi)
const minutes = startTime.getUTCMinutes()  // 0

const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
// "04:00"
```

---

### 2. Turnus ID vs Turnus Name - KRITIČNO!

**Problem:** Isti turnus ima više ID-eva!

```sql
-- Primer iz baze:
turnus_id | turnus_name | line_no | status
----------|-------------|---------|--------
219284    | 00018-1     | 18A     | N (neaktivna varijanta)
274206    | 00018-1     | 18      | A (aktivna varijanta)
```

**Rešenje:** UVEK grupiši po `turnus_name`, NE po `turnus_id`!

```typescript
// ❌ POGREŠNO
const groupedTurnusi = turnusi.reduce((acc, curr) => {
  const existing = acc.find(t => t.turnusId === curr.turnusId)
  // Biće 2 grupe za isti turnus!
}, [])

// ✅ ISPRAVNO
const groupedTurnusi = turnusi.reduce((acc, curr) => {
  const existing = acc.find(t => t.turnusName === curr.turnusName)
  // Jedna grupa sa svim ID-evima
  if (existing) {
    existing.turnusIds.push(curr.turnusId)  // dodaj ID
  } else {
    acc.push({
      turnusId: curr.turnusId,       // prvi ID
      turnusIds: [curr.turnusId],     // lista svih ID-eva
      turnusName: curr.turnusName,
      ...
    })
  }
}, [])
```

**Takođe:** Pronalaženje najnovijeg turnusa

```typescript
// Pronađi turnus_id sa MAX(change_time)
const latestTurnusId = await prisma.$queryRaw`
  SELECT turnus_id
  FROM changes_codes_tours
  WHERE turnus_name = ${turnusName}
    AND shift_number = ${shiftNumber}
  GROUP BY turnus_id
  ORDER BY MAX(change_time) DESC  -- NAJNOVIJI!
  LIMIT 1
`
```

---

### 3. line_number vs line_number_for_display

**Problem:** Različiti nivoi granularnosti!

```sql
-- Primer iz baze:
id  | line_number | line_number_for_display | line_title         | status
----|-------------|-------------------------|--------------------|-------
1   | 18A         | 18                      | Zvezdara - Banovo  | A
2   | 18B         | 18                      | Banovo - Zvezdara  | A
3   | 18VAR1      | 18                      | Varijanta 1        | A
```

**Kada koristiti šta:**

```typescript
// Za prikaz korisniku (dropdown, tabele)
getLines() {
  return prisma.$queryRaw`
    SELECT line_number_for_display, MIN(line_title)
    FROM lines
    GROUP BY line_number_for_display  -- eliminiše duplikate!
  `
}

// Za povezivanje sa changes_codes_tours
const turnusi = await prisma.$queryRaw`
  SELECT * FROM changes_codes_tours
  WHERE line_no = ${line.line_number}  -- NE lineNumberForDisplay!
`

// Za filtriranje korisničkog izbora
const lineNumber = "18"  // line_number_for_display
const variants = await prisma.line.findMany({
  where: { lineNumberForDisplay: lineNumber }  // dobavi sve varijante
})
```

---

### 4. Smene koje prelaze preko ponoći

**Problem:**
```
Smena počinje: 18:19
Smena se završava: 02:00 (sledeći dan)
Trajanje: 02:00 - 18:19 = -16:19 (NEGATIVNO!)
```

**Rešenje:** Dodaj 24h ako je negativno

```typescript
let durationMinutes = Math.floor((endMs - startMs) / (1000 * 60))

// Provera: Da li prelazi preko ponoći?
if (durationMinutes < 0) {
  durationMinutes += 24 * 60  // dodaj 24 sata (1440 minuta)
}

// Sada: 02:00 - 18:19 + 24:00 = 07:41 ✅
```

---

### 5. Direction = 0 za eliminaciju duplikata

**Problem:** Svaki polazak postoji u 2 reda (smer A i B)

```sql
-- Primer:
id    | turnus_id | line_no | start_time | direction
------|-----------|---------|------------|----------
1234  | 274206    | 18      | 04:00      | 0 (smer A)
1235  | 274206    | 18      | 04:00      | 1 (smer B)  -- DUPLIKAT!
```

**Rešenje:** Filtriraj samo `direction = 0`

```typescript
const departures = await prisma.$queryRaw`
  SELECT * FROM changes_codes_tours
  WHERE turnus_id = ${turnusId}
    AND shift_number = ${shiftNumber}
    AND direction = 0  -- SAMO smer A!
`
```

---

### 6. turnus_groups_assign - Provera važenja turnusa

**Problem:** Isti turnus može imati različite periode važenja

```sql
-- Primer iz baze:
turnus_id | turnus_name | date_from  | date_to
----------|-------------|------------|------------
274206    | 00018-1     | 2024-01-01 | 2024-12-31  -- Zastareo!
274207    | 00018-1     | 2025-01-01 | 2025-12-31  -- Aktuelan!
```

**Posledica bez filtera:**
- Prikazivanje zastarelih turnusa u dropdown-u
- Kreiranje rasporeda sa pogrešnim/zastarelim polascima
- Nekonzistentni podaci između planning i admin modula

**Rešenje:** UVEK JOIN sa `turnus_groups_assign` i filter po datumu

```typescript
// ✅ ISPRAVNO - planning.service.ts
const turnusi = await prisma.$queryRaw`
  SELECT DISTINCT cct.turnus_id, cct.turnus_name, cct.shift_number
  FROM changes_codes_tours cct
  INNER JOIN turnus_days td ON cct.turnus_id = td.turnus_id
  INNER JOIN turnus_groups_assign tga ON cct.turnus_id = tga.turnus_id  -- ✅
  INNER JOIN \`lines\` l ON cct.line_no = l.line_number
  WHERE l.line_number_for_display = '18'
    AND td.dayname = 'Sreda'
    AND DATE('2025-10-22') BETWEEN tga.date_from AND tga.date_to  -- ✅ KLJUČNO!
`

// ❌ POGREŠNO - bez turnus_groups_assign
const turnusi = await prisma.$queryRaw`
  SELECT DISTINCT cct.turnus_id, cct.turnus_name
  FROM changes_codes_tours cct
  INNER JOIN turnus_days td ON cct.turnus_id = td.turnus_id
  -- NEMA turnus_groups_assign JOIN - može uzeti zastarele turnuse!
`
```

**Gde se primenjuje:**
- ✅ `getTurnusiByLineAndDate()` - prikazivanje turnusa u dropdown-u (linija 85)
- ✅ `createSchedule()` - pronalaženje najnovijeg turnus_id (linija 463)
- ✅ `createSchedule()` - dobavljanje polazaka za upis (linija 524)

**Konzistentnost sa drugim modulima:**
```typescript
// Admin modul - turnusi.service.ts:getTurnusiGroupedByLineNumber()
// Koristi ISTU logiku:
INNER JOIN turnus_groups_assign tga ON cct.turnus_id = tga.turnus_id
AND CURDATE() BETWEEN tga.date_from AND tga.date_to
```

---

### 6. Price variations provera datuma

**Problem:** Ista linija može imati različite varijacije cena (npr. letnji/zimski raspored)

```sql
-- Primer:
price_variation_id | datetime_from    | datetime_to      | description
-------------------|------------------|------------------|-------------
1                  | 2025-06-01 00:00 | 2025-08-31 23:59 | Letnji raspored
2                  | 2025-09-01 00:00 | 2025-05-31 23:59 | Zimski raspored
```

**Rešenje:** Proveri da li datum pada u opseg

```typescript
const turnusi = await prisma.$queryRaw`
  SELECT * FROM changes_codes_tours cct
  INNER JOIN lines l ON cct.line_no = l.line_number
  LEFT JOIN price_variations pv ON l.price_variation_id = pv.id
  WHERE (
    l.price_variation_id = 0
    OR pv.id IS NULL
    OR DATE(${date}) BETWEEN DATE(pv.datetime_from) AND DATE(pv.datetime_to)
  )
`
```

---

### 7. Dual-write strategija (date_travel_order + date_shedule)

**Problem:** Moramo održavati 2 tabele sinhronizovanim!

**Strategija:**

```typescript
// KREIRANJE:
try {
  // 1. Upiši u date_travel_order (Smart City tabela)
  for (departure of departures) {
    await prisma.dateTravelOrder.create({ ... })
  }

  // 2. Sync sa legacy date_shedule
  try {
    await syncToLegacySchedule({ ... })
  } catch (error) {
    // NE BLOKIRAJ glavni proces ako legacy sync ne uspe!
    console.error('Legacy sync failed, but main process continues')
  }

} catch (error) {
  // Glavni proces je failo - vrati grešku
  throw error
}

// BRISANJE:
try {
  // 1. Obriši iz date_travel_order
  const deleteResult = await prisma.dateTravelOrder.deleteMany({ ... })

  // 2. Obriši iz legacy date_shedule
  try {
    await deleteFromLegacySchedule({ ... })
  } catch (error) {
    // NE BLOKIRAJ glavni proces
    console.error('Legacy delete failed')
  }

} catch (error) {
  throw error
}
```

**Važno:**
- **Glavni proces:** date_travel_order (mora da uspe)
- **Legacy sync:** best-effort (greška se loguje ali ne blokira)

---

### 8. Dinamički table name za stanice

**Problem:** Imena stanica se nalaze u dinamičkim tabelama po datumu!

```sql
-- Primer:
price_lists_line_uids_2025_01_15  -- za date_valid_from = 2025-01-15
price_lists_line_uids_2025_06_01  -- za date_valid_from = 2025-06-01
```

**Rešenje:**

```typescript
const getLineStations = async (legacyTicketingId, dateValidFrom) => {
  // 1. Formatiraj datum za ime tabele
  const dateStr = dateValidFrom.split('T')[0]  // "2025-01-15"
  const tableName = `price_lists_line_uids_${dateStr.replace(/-/g, '_')}`
  // "price_lists_line_uids_2025_01_15"

  // 2. Proveri da li tabela postoji
  const tableExists = await checkIfTableExists(tableName)
  if (!tableExists) return { startStation: '', endStation: '' }

  // 3. Dohvati imena stanica
  const startStation = await prisma.$queryRawUnsafe(`
    SELECT usil.station_name
    FROM ${tableName} plu
    LEFT JOIN unique_station_id_local usil ON usil.unique_id = plu.station_uid
    WHERE plu.price_tables_index_id = ?
    ORDER BY plu.station_number ASC
    LIMIT 1
  `, legacyTicketingId)

  // ... isto za endStation (DESC)
}
```

---

## 📋 Česti problemi i rešenja

### Problem 1: "Turnus nije pronađen"

**Greška:**
```
NotFoundException: Turnus 274206 nije pronađen
```

**Uzrok:**
- Turnus_id se promenio (nova verzija reda vožnje)
- Linija prešla u neaktivan status
- Price variation više ne važi za taj datum

**Rešenje:**
```typescript
// Proveri u bazi:
SELECT * FROM changes_codes_tours
WHERE turnus_id = 274206

// Ako nema zapisa, pronađi najnoviji:
SELECT turnus_id, MAX(change_time)
FROM changes_codes_tours
WHERE turnus_name = '00018-1'
  AND shift_number = 1
GROUP BY turnus_id
ORDER BY MAX(change_time) DESC
```

---

### Problem 2: Duplikati u turnusima

**Greška:**
```
Turnus 00018-1 se pojavljuje 2 puta u dropdown-u
```

**Uzrok:** Grupisanje po `turnus_id` umesto po `turnus_name`

**Rešenje:**
```typescript
// Promeni grupisanje:
const existingTurnus = acc.find(t => t.turnusName === curr.turnus_name)
// NE: t.turnusId === curr.turnus_id
```

---

### Problem 3: Vozač se prikazuje kao "zauzet" iako je slobodan

**Greška:**
```
Vozač ima scheduledShifts.length > 0 ali nema preklapanja sa traženom smenom
```

**Uzrok:** Frontend filteri nisu primenjeni

**Rešenje:**
```typescript
// Primeni timeOverlapFilter:
import { hasTimeOverlap } from './filters/timeOverlapFilter'

const isBusy = driver.scheduledShifts.some(shift =>
  hasTimeOverlap(shift, requestedShift)
)
```

---

### Problem 4: "Nema polazaka za turnus"

**Greška:**
```
NotFoundException: Nema polazaka za turnus 00018-1, smenu 1 na dan Sreda
```

**Uzrok:**
- Dan nije definisan u `turnus_days`
- Linija je neaktivna (`status = 'N'`)
- Price variation ne pokriva taj datum

**Rešenje:**
```sql
-- Proveri turnus_days:
SELECT * FROM turnus_days
WHERE turnus_id = 274206 AND dayname = 'Sreda'

-- Proveri aktivnost linije:
SELECT * FROM lines
WHERE line_number_for_display = '18'
  AND status = 'A'

-- Proveri price variations:
SELECT * FROM price_variations pv
INNER JOIN lines l ON l.price_variation_id = pv.id
WHERE l.line_number_for_display = '18'
  AND '2025-10-22' BETWEEN DATE(pv.datetime_from) AND DATE(pv.datetime_to)
```

---

### Problem 5: Legacy sync greška

**Greška:**
```
❌ Greška pri sinhronizaciji u date_shedule: Duplicate entry...
```

**Uzrok:** Legacy tabela već ima zapis za taj polazak

**Rešenje:**
```typescript
// Glavni proces NASTAVLJA!
// Legacy sync je "best-effort" - greška se loguje ali ne blokira

console.error('❌ Greška pri sinhronizaciji u date_shedule:', error.message)
console.error('  Glavni proces planiranja nastavlja (upis u date_travel_order je uspeo)')
```

---

## 🔍 Debug saveti

### 1. Provera kreiranog rasporeda

```sql
-- Proveri koliko je polazaka kreirano:
SELECT COUNT(*) FROM date_travel_order
WHERE start_date = '2025-10-22'
  AND driver_id = 15
  AND line_no = '18'
  AND comment LIKE '%Turnus: 00018-1, Smena: 1%'

-- Trebalo bi da vrati broj koji odgovara broju polazaka (npr. 45)

-- Proveri prvi i poslednji polazak:
SELECT start_time, end_time, comment
FROM date_travel_order
WHERE start_date = '2025-10-22' AND driver_id = 15
ORDER BY start_time ASC
LIMIT 1

SELECT start_time, end_time, comment
FROM date_travel_order
WHERE start_date = '2025-10-22' AND driver_id = 15
ORDER BY start_time DESC
LIMIT 1
```

---

### 2. Provera najnovijeg turnus_id

```sql
-- Za dato turnusName i smenu, pronađi najnoviji turnus_id:
SELECT
  turnus_id,
  turnus_name,
  line_no,
  MAX(change_time) as latest_change
FROM changes_codes_tours
WHERE turnus_name = '00018-1'
  AND shift_number = 1
GROUP BY turnus_id
ORDER BY latest_change DESC
```

---

### 3. Provera dostupnosti vozača

```sql
-- Proveri da li vozač ima već isplanirane polaske za taj dan:
SELECT
  driver_id,
  driver_name,
  line_no,
  comment,
  start_time,
  end_time
FROM date_travel_order
WHERE start_date = '2025-10-22'
  AND driver_id = 15
ORDER BY start_time ASC
```

---

### 4. Provera legacy sync-a

```sql
-- Proveri da li je sync uspeo:
SELECT COUNT(*) FROM date_shedule
WHERE start_date = '2025-10-22'
  AND user_1_id_planned = 123  -- driver.legacyId
  AND line_no = '18'

-- Proveri detalje:
SELECT * FROM date_shedule
WHERE start_date = '2025-10-22'
  AND user_1_id_planned = 123
ORDER BY start_time ASC
```

---

## 🚀 Performance optimizacije

### 1. Učitavanje samo preporučenih vozača

**Problem:** Učitavanje svih vozača (200+) traje 5-10 sekundi

**Rešenje:**
```typescript
// Prvo učitaj samo preporučene (10-20 vozača)
const data = await planningService.getDriversAvailability({
  onlyRecommended: true  // brže!
})

// Ako korisnik klikne "Prikaži sve"
const allData = await planningService.getDriversAvailability({
  onlyRecommended: false  // sve vozače
})
```

---

### 2. Frontend search umesto backend filtera

**Problem:** Backend pretraga zahteva novi API poziv

**Rešenje:**
```typescript
// Učitaj sve vozače jednom
const drivers = await getDriversAvailability({ ... })

// Frontend pretraga:
const searchedDrivers = drivers.filter(driver =>
  driver.fullName.toLowerCase().includes(searchTerm.toLowerCase())
)
```

---

### 3. Batch insert polazaka

**Problem:** 45 INSERT-ova traje 2-3 sekunde

**Rešenje:**
```typescript
// Koristi createMany (bulk insert)
await prisma.dateTravelOrder.createMany({
  data: allDepartures.map(departure => ({
    // ... podaci za polazak
  }))
})
```

---

## 🔧 Ažuriranja i popravke sistema

### 📅 2025-10-22 - Mesečni prikaz i brisanje rasporeda

#### Problem: Nedostatak pregleda i upravljanja mesečnim rasporedima

**Simptom:**
- Korisnik može da kreira mesečne rasporede, ali ne može da ih vidi sve odjednom
- Ne može da filtrira rasporede po datumu, turnusu ili vozaču
- Brisanje rasporeda je moguće samo za pojedinačne dane
- Nema mogućnosti masovnog brisanja za ceo mesec

**Uzrok:**
- Tab "Mesečni" je postojao samo za kreiranje, ne i za pregled
- Nije postojao backend endpoint za dobavljanje svih rasporeda za mesec/liniju
- Nije postojala opcija za brisanje turnusa/smene za ceo mesec

**Posledica:**
- Korisnik mora da gleda svaki dan posebno da bi video šta je isplanirano
- Ne može brzo da pronađe raspored za određenog vozača ili turnus
- Mora da briše svaki dan pojedinačno ako želi da ukloni raspored za ceo mesec

---

#### Rešenje: Tab "Mesečni" sa prikazom i naprednim brisanjem

**Dodati fajlovi:**

1. **Backend:**
   - `getMonthlySchedulesByLine()` metoda u `planning.service.ts`
   - GET endpoint `/planning/schedule/monthly` u `planning.controller.ts`
   - `deleteMonthlySchedule()` metoda u `planning.service.ts`
   - DELETE endpoint `/planning/schedule/monthly/:id/:startDate` u `planning.controller.ts`
   - `getAllDatesInMonth()` helper metoda
   - Refaktorisan `deleteFromLegacySchedule()` (izbegava MySQL LIMIT u subquery)

2. **Frontend:**
   - `/components/MonthlyScheduleForm.tsx` - Pregled rasporeda za mesec sa filterima
   - `/components/DeleteScheduleModal.tsx` - Custom modal za brisanje
   - `getMonthlySchedules()` metoda u `planning.service.ts`
   - `deleteMonthlySchedule()` metoda u `planning.service.ts`

---

#### Implementacija: Backend endpoints

**GET /planning/schedule/monthly**

**Lokacija:** `/apps/backend/src/planning/planning.controller.ts` (linija 154-171)

**Query parametri:**
- `month` - mesec (1-12)
- `year` - godina (2020-2100)
- `lineNumber` - broj linije (npr. "18")

**Servisna metoda:** `getMonthlySchedulesByLine(query)` - Linija 939-969

**Logika:**
1. Generiše sve datume u mesecu (`getAllDatesInMonth`)
2. Za svaki datum poziva `getSchedulesByDate()`
3. Filtrira samo rasporede za odabranu liniju
4. Sortira po: datum → turnus (natural sort) → smena
5. Vraća listu svih grupisanih rasporeda

**Primer:**
```typescript
GET /api/planning/schedule/monthly?month=11&year=2025&lineNumber=18

// Rezultat:
[
  {
    id: 123,
    date: "2025-11-01",
    lineNumber: "18",
    turnusName: "00018-1",
    shiftNumber: 1,
    driverId: 15,
    driverName: "Marko Marković",
    departuresCount: 45,
    turnusDuration: "04:00 - 23:15 (19:15)"
  },
  // ... svi ostali rasporedi za mesec
]
```

---

**DELETE /planning/schedule/monthly/:id/:startDate**

**Lokacija:** `/apps/backend/src/planning/planning.controller.ts` (linija 273-318)

**Path parametri:**
- `id` - ID prvog polaska u rasporedu
- `startDate` - datum prvog polaska (ISO format)

**Query parametri:**
- `month` - mesec (1-12)
- `year` - godina
- `lineNumber` - broj linije
- `turnusName` - ime turnusa (npr. "00018-1")
- `shiftNumber` - broj smene (1, 2, 3)

**Servisna metoda:** `deleteMonthlySchedule(params)` - Linija 1045-1121

**Logika:**
1. Generiše sve datume u mesecu (`getAllDatesInMonth`)
2. Za svaki datum:
   - Formatira datum (`formatDateForQuery` + `new Date`)
   - Pronalazi rasporede po liniji, turnusu i smeni
   - Briše SVE polaske za taj datum
   - Briše iz legacy `date_shedule` tabele
3. Nastavlja sa sledećim datumom čak i ako bude greške
4. Vraća sumarno: ukupno obrisanih polazaka i broj dana

**Error handling:**
```typescript
try {
  // Obradi datum
} catch (error) {
  // Loguj grešku ALI NASTAVI sa sledećim datumom
  logger.error(`Greška za datum ${date}:`, error)
}
```

**Primer:**
```typescript
DELETE /api/planning/schedule/monthly/123/2025-11-01
  ?month=11&year=2025&lineNumber=18&turnusName=00018-1&shiftNumber=1

// Rezultat:
{
  success: true,
  message: "Mesečni raspored uspešno obrisan (obrisano 1350 polazaka za 30 dana)",
  deletedCount: 1350,  // 45 polazaka x 30 dana
  daysDeleted: 30
}
```

---

#### Implementacija: Frontend komponente

**MonthlyScheduleForm.tsx**

**Lokacija:** `/apps/admin-portal/src/pages/transport/planning/components/MonthlyScheduleForm.tsx`

**State:**
```typescript
const [selectedMonth, setSelectedMonth] = useState(dayjs())
const [selectedLine, setSelectedLine] = useState(null)
const [monthlySchedules, setMonthlySchedules] = useState([])
const [filteredSchedules, setFilteredSchedules] = useState([])
const [filterDate, setFilterDate] = useState('')       // "" = "Svi dani"
const [filterTurnus, setFilterTurnus] = useState('')   // "" = "Svi turnusi"
const [filterDriver, setFilterDriver] = useState(null) // null = "Svi vozači"
const [deleteModalVisible, setDeleteModalVisible] = useState(false)
const [scheduleToDelete, setScheduleToDelete] = useState(null)
```

**Funkcije:**
```typescript
// Učitavanje
const loadMonthlySchedules = async () => {
  const data = await planningService.getMonthlySchedules(month, year, lineNumber)
  setMonthlySchedules(data)
  extractUniqueTurnusi(data)
  extractUniqueDrivers(data)
  extractUniqueDates(data)
}

// Filterovanje (frontend - bez API poziva)
const applyFilters = () => {
  let filtered = monthlySchedules

  if (filterDate) {
    filtered = filtered.filter(s => s.date === filterDate)
  }
  if (filterTurnus) {
    filtered = filtered.filter(s => s.turnusName === filterTurnus)
  }
  if (filterDriver) {
    filtered = filtered.filter(s => s.driverId === filterDriver)
  }

  setFilteredSchedules(filtered)
}

// Brisanje
const handleDeleteConfirm = async (scope: 'day' | 'month') => {
  if (scope === 'day') {
    // Obriši samo za taj dan
    await planningService.deleteSchedule(id, date)
  } else {
    // Obriši za ceo mesec
    await planningService.deleteMonthlySchedule(
      id, date, month, year, lineNumber, turnusName, shiftNumber
    )
  }
  await loadMonthlySchedules()  // Reload table
}
```

**Tabela:**
- Kolone: Datum | Linija | Turaža | Smena | Vreme | Polasci | Vozač | Akcije
- Filteri iznad tabele (3 dropdown-a)
- "Obriši" dugme otvara `DeleteScheduleModal`

---

**DeleteScheduleModal.tsx**

**Lokacija:** `/apps/admin-portal/src/pages/transport/planning/components/DeleteScheduleModal.tsx`

**Props:**
```typescript
interface DeleteScheduleModalProps {
  visible: boolean
  schedule: Schedule | null
  onConfirm: (scope: 'day' | 'month') => void
  onCancel: () => void
}
```

**State:**
```typescript
const [deleteScope, setDeleteScope] = useState<'day' | 'month'>('day')
```

**Prikaz:**
1. **Informacije o rasporedu:**
   - Datum (formatiran sa nazivom dana: "Sreda, 01. novembar 2025.")
   - Linija: 18 - Zvezdara - Banovo brdo
   - Turaža: 00018-1
   - Smena: Prva smena
   - Vozač: Marko Marković

2. **Radio button opcije:**
   - ⦿ Obriši samo za ovaj dan (default)
   - ○ Obriši za ceo mesec (isti turnus i smena)

3. **Upozorenje (prikazuje se ako je odabrano "mesec"):**
   - Crveni okvir sa ikonom upozorenja
   - "Ova akcija će obrisati sve rasporede za odabrani turnus i smenu u celom mesecu. Akcija se ne može poništiti."

---

#### Datum formatting - Timezone problem i rešenje

**Problem:**
```typescript
// getAllDatesInMonth() kreira Date objekte:
dates.push(new Date(year, month - 1, day))

// Direktno korišćenje u WHERE uslovu:
where: { startDate: date }  // ❌ Timezone problemi!
```

**MySQL DATE kolona prima Date objekat ali ga konvertuje u UTC bez vremena.**

**Rešenje:**
```typescript
// 1. Formatiraj datum u 'YYYY-MM-DD' string
const formattedDate = formatDateForQuery(date)  // "2025-11-01"

// 2. Kreiraj novi Date objekat iz formatiranog stringa
const dateForQuery = new Date(formattedDate)

// 3. Koristi u WHERE uslovu
where: { startDate: dateForQuery }  // ✅ Konzistentno!
```

**Ista logika kao u drugim metodama:**
- `getMonthlySchedulesByLine()` - koristi `formatDateForQuery()`
- `createSchedule()` - koristi `new Date(formattedDate)`
- `deleteMonthlySchedule()` - koristi `formatDateForQuery()` + `new Date()`

---

#### deleteFromLegacySchedule() refaktoring

**Problem:** MySQL greška sa LIMIT u subquery-ju
```
Raw query failed. Code: `1235`. Message: `This version of MySQL doesn't yet support 'LIMIT & IN/ALL/ANY/SOME subquery'`
```

**BEFORE:**
```typescript
await prisma.$executeRawUnsafe(`
  DELETE FROM date_shedule
  WHERE line_no = ? AND start_date = ?
    AND tour_id IN (
      SELECT turnus_id FROM changes_codes_tours
      WHERE turnus_name = ? AND shift_number = ?
      LIMIT 1  -- ❌ MySQL ne podržava!
    )
`)
```

**AFTER:**
```typescript
// 1. Prvo dobavi turnus_id
const turnusResult = await prisma.$queryRawUnsafe(`
  SELECT turnus_id FROM changes_codes_tours
  WHERE turnus_name = ? AND shift_number = ?
  LIMIT 1
`)

// 2. Zatim obriši direktno (bez subquery-ja)
if (turnusResult && turnusResult.length > 0) {
  const turnusId = turnusResult[0].turnus_id

  await prisma.$executeRawUnsafe(`
    DELETE FROM date_shedule
    WHERE line_no = ? AND start_date = ?
      AND user_1_id_planned = ?
      AND tour_id = ?  -- ✅ Direktna vrednost!
  `)
}
```

---

#### Uticaj na postojeće funkcionalnosti

**Tab "Dnevni":**
- ✅ Nije promenjen
- ✅ `deleteSchedule()` metoda ostaje ista

**Tab "Mesečni":**
- ✅ Sada ima prikaz svih rasporeda za mesec/liniju
- ✅ Dodati filteri za brže pronalaženje
- ✅ Nova opcija za brisanje za ceo mesec
- ✅ Error handling - greška na jednom danu ne blokira ostale

**Legacy sync:**
- ✅ Refaktorisan `deleteFromLegacySchedule()` za kompatibilnost sa MySQL
- ✅ Greška u legacy sync-u NE blokira glavni proces

---

### 📅 2025-10-22 - Ispravka foreign key relacije i simplifikacija vremena

#### Problem 1: Pogrešan `shedule_id` u `date_travel_order`

**Simptom:**
```sql
-- date_travel_order tabela je imala pogrešnu vrednost u shedule_id koloni:
SELECT shedule_id FROM date_travel_order WHERE id = 123;
-- Rezultat: 274206 (turnus_id umesto date_shedule.id!)
```

**Uzrok:**
- **Pogrešan redosled upisa:** Prvo se pisalo u `date_travel_order`, pa tek onda u `date_shedule`
- **Pogrešna vrednost:** Upisivao se `dto.turnusId` umesto stvarnog autoincrement ID-a iz `date_shedule`
- **Raw SQL:** `syncToLegacySchedule()` je koristila raw SQL INSERT koji nije vraćao kreirane ID-eve

**Posledica:**
- Foreign key `date_travel_order.shedule_id → date_shedule.id` nije funkcionisao
- Nemogućnost JOINa između dve tabele
- Nekonzistentnost podataka

---

#### Rešenje: Refaktoring `syncToLegacySchedule()` i promena redosleda

**Promena 1: Refaktoring `syncToLegacySchedule()` metode**

**Lokacija:** `/apps/backend/src/planning/planning.service.ts` (linije 1003-1112)

**BEFORE:**
```typescript
private async syncToLegacySchedule(data: {
  lineNo: string;
  lineName: string;
  // ... ostali parametri
}): void {  // ❌ Nije vraćala ID-eve
  try {
    for (let i = 0; i < data.departures.length; i++) {
      // ❌ Raw SQL - nema povratne vrednosti
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO date_shedule (
          line_no, start_date, start_time, ...
        ) VALUES (?, ?, ?, ...)
      `, data.lineNo, data.startDate, ...);
    }
  } catch (error) {
    console.error('Error syncing...');
  }
}
```

**AFTER:**
```typescript
private async syncToLegacySchedule(data: {
  lineNo: string;
  lineName: string;
  // ... ostali parametri
}): Promise<number[]> {  // ✅ Vraća niz ID-eva!
  const createdIds: number[] = [];

  try {
    for (let i = 0; i < data.departures.length; i++) {
      const departure = data.departures[i];

      const startTime = departure.start_time;
      const duration = departure.duration;
      const endTime = new Date(startTime);
      endTime.setUTCHours(
        startTime.getUTCHours() + duration.getUTCHours(),
        startTime.getUTCMinutes() + duration.getUTCMinutes(),
        startTime.getUTCSeconds() + duration.getUTCSeconds()
      );

      // ✅ Prisma create() - vraća kreirani objekat sa ID-em
      const createdSchedule = await this.prisma.dateShedule.create({
        data: {
          lineNo: data.lineNo,
          lineName: data.lineName,
          startDate: data.startDate,
          startTime: startTime,  // ✅ Direktno, bez konverzije
          endTime: endTime,
          endDate: data.startDate,
          startStation: data.startStation,
          endStation: data.endStation,
          ttStartDate: data.startDate,
          ttStartTime: startTime,  // ✅ Direktno, bez konverzije
          user1IdPlanned: data.driverLegacyId || 0,
          user1IdRealised: 0,
          user2IdPlanned: 0,
          user2IdRealised: 0,
          user3IdPlanned: 0,
          user3IdRealised: 0,
          tourId: data.turnusId,
          turnusDepartureNo: departure.departure_number,
          direction: departure.direction,
          // ... sva ostala polja sa default vrednostima
        },
      });

      createdIds.push(createdSchedule.id);  // ✅ Sakupi ID
    }

    return createdIds;  // ✅ Vrati niz ID-eva
  } catch (error) {
    console.error('❌ Greška pri sinhronizaciji u date_shedule:', error.message);
    // Vrati niz nula da ne blokiramo glavni proces
    return new Array(data.departures.length).fill(0);
  }
}
```

**Ključne izmene:**
- ✅ Promenjen return type sa `void` na `Promise<number[]>`
- ✅ Koristi Prisma `create()` umesto raw SQL `$executeRawUnsafe()`
- ✅ Sakuplja ID-eve u `createdIds` niz
- ✅ Vraća niz ID-eva na kraju
- ✅ Error handling - vraća niz nula ako sync ne uspe (ne blokira glavni proces)

---

**Promena 2: Novi redosled u `createSchedule()` metodi**

**Lokacija:** `/apps/backend/src/planning/planning.service.ts` (linije 549-716)

**BEFORE:**
```typescript
async createSchedule(dto: CreateScheduleDto, userId: number) {
  // ... validacija ...

  // ❌ PRVO: Kreiranje u date_travel_order
  for (let i = 0; i < allDepartures.length; i++) {
    const schedule = await this.prisma.dateTravelOrder.create({
      data: {
        sheduleId: dto.turnusId,  // ❌ POGREŠNO! Upisuje turnusId
        startDate,
        driverId: dto.driverId,
        // ... ostala polja
      }
    });
  }

  // ❌ POSLE: Sync sa legacy date_shedule
  await this.syncToLegacySchedule({ ... });

  return { ... };
}
```

**AFTER:**
```typescript
async createSchedule(dto: CreateScheduleDto, userId: number) {
  // ... validacija ...

  // Dobavi imena stanica
  const stations = await this.getLineStations(
    firstDep.legacy_ticketing_id,
    firstDep.date_valid_from
  );

  // ✅ PRVO: Kreiraj u date_shedule i dobij ID-eve
  const dateSheduleIds = await this.syncToLegacySchedule({
    lineNo: dto.lineNumber,
    lineName: line.lineTitle,
    startStation: stations.startStation,
    endStation: stations.endStation,
    startDate,
    driverId: dto.driverId,
    driverName: `${driver.firstName} ${driver.lastName}`,
    driverLegacyId: driver.legacyId,
    turnusId: dto.turnusId,
    turnusName: turnusInfo.turnusName,
    shiftNumber: dto.shiftNumber,
    departures: allDepartures.map(d => ({
      start_time: d.start_time,
      duration: d.duration,
      direction: d.direction,
      departure_number: d.departure_number,
    })),
  });

  // ✅ POSLE: Kreiraj u date_travel_order sa pravilnim sheduleId
  for (let i = 0; i < allDepartures.length; i++) {
    const departure = allDepartures[i];

    const departureStartTime = new Date(departure.start_time);
    const departureDuration = new Date(departure.duration);
    const endTime = new Date(departureStartTime);
    endTime.setUTCHours(
      departureStartTime.getUTCHours() + departureDuration.getUTCHours(),
      departureStartTime.getUTCMinutes() + departureDuration.getUTCMinutes(),
      departureStartTime.getUTCSeconds() + departureDuration.getUTCSeconds()
    );

    const schedule = await this.prisma.dateTravelOrder.create({
      data: {
        sheduleId: dateSheduleIds[i],  // ✅ ISPRAVNO! Koristi ID iz date_shedule
        startDate,
        driverId: dto.driverId,
        driverName: `${driver.firstName} ${driver.lastName}`,
        lineNo: dto.lineNumber,
        lineName: line.lineTitle,
        startTime: departure.start_time,
        endTime: endTime,
        // ... ostala polja
      }
    });

    createdSchedules.push({ id: schedule.id });
  }

  // ✅ Nema duplicate syncToLegacySchedule() poziva ovde

  return { ... };
}
```

**Ključne izmene:**
- ✅ `syncToLegacySchedule()` se poziva **PRE** `date_travel_order` inserta
- ✅ Dobijeni ID-evi se čuvaju u `dateSheduleIds` nizu
- ✅ `sheduleId: dateSheduleIds[i]` - koristi stvarni `date_shedule.id` umesto `turnusId`
- ✅ Uklonjen duplicirani poziv `syncToLegacySchedule()` koji je bio posle for petlje

---

#### Problem 2: Redundantna konverzija vremena

**Simptom:**
```typescript
// Postojala je funkcija koja je pravila novi Date objekat ali samo kopirala UTC vreme:
const formatTimeAsDate = (time: Date): Date => {
  const base = new Date('1970-01-01T00:00:00.000Z');
  base.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), time.getUTCSeconds());
  return base;
};
```

**Uzrok:**
- Over-engineering - funkcija nije radila nikakvu stvarnu konverziju
- Samo je kopirala UTC vreme iz jednog Date objekta u drugi
- Vremena iz `changes_codes_tours.start_time` već dolaze kao Date objekti u UTC

**Rešenje: Simplifikacija**

**BEFORE:**
```typescript
const startTime = new Date(departure.start_time);  // Nova instanca
const formatTimeAsDate = (time: Date): Date => {
  const base = new Date('1970-01-01T00:00:00.000Z');
  base.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), time.getUTCSeconds());
  return base;
};

// U date_shedule insert:
startTime: formatTimeAsDate(startTime),
ttStartTime: formatTimeAsDate(startTime),
```

**AFTER:**
```typescript
const startTime = departure.start_time;  // ✅ Direktno iz MySQL

// U date_shedule insert:
startTime: startTime,      // ✅ Direktna vrednost, bez konverzije
ttStartTime: startTime,    // ✅ Direktna vrednost, bez konverzije
```

**Rezultat:**
- Kod je jednostavniji i čitljiviji
- Nema nepotrebnih Date instanci
- Vremena se upisuju identično kao što su pročitana iz baze
- UTC handling ostaje konzistentan

---

#### Kako proveriti ispravnost

**SQL provera foreign key relacije:**
```sql
-- Proveri da li shedule_id u date_travel_order odgovara ID-evima u date_shedule:
SELECT
  dto.id,
  dto.shedule_id AS dto_shedule_id,
  ds.id AS ds_actual_id,
  CASE
    WHEN dto.shedule_id = ds.id THEN '✅ OK'
    ELSE '❌ POGREŠNO'
  END AS status
FROM date_travel_order dto
INNER JOIN date_shedule ds ON
  ds.line_no = dto.line_no
  AND ds.start_date = dto.start_date
  AND ds.start_time = dto.start_time
  AND ds.user_1_id_planned = (SELECT legacy_id FROM users WHERE id = dto.driver_id)
WHERE dto.start_date = '2025-10-22'
ORDER BY dto.start_time ASC;

-- Trebalo bi da SVE vrste imaju status '✅ OK'
```

**SQL provera da li vremena odgovaraju:**
```sql
-- Proveri da li start_time i end_time u obe tabele odgovaraju:
SELECT
  dto.start_time AS dto_start,
  ds.start_time AS ds_start,
  dto.end_time AS dto_end,
  ds.end_time AS ds_end,
  CASE
    WHEN TIME(dto.start_time) = TIME(ds.start_time)
     AND TIME(dto.end_time) = TIME(ds.end_time) THEN '✅ OK'
    ELSE '❌ RAZLIKA'
  END AS status
FROM date_travel_order dto
INNER JOIN date_shedule ds ON ds.id = dto.shedule_id
WHERE dto.start_date = '2025-10-22'
ORDER BY dto.start_time ASC;
```

---

#### Uticaj na postojeće funkcionalnosti

**Dnevno planiranje:**
- ✅ Koristi ažuriranu `createSchedule()` metodu
- ✅ Automatski dobija ispravne foreign key vrednosti

**Mesečno planiranje:**
- ✅ Poziva `createSchedule()` za svaki dan u mesecu
- ✅ Automatski dobija sve popravke

**Legacy sinhronizacija:**
- ✅ Sada koristi Prisma `create()` umesto raw SQL
- ✅ Vraća ID-eve koji se koriste u `date_travel_order`
- ✅ Error handling - greška u legacy sync-u ne blokira glavni proces

---

### 📅 2025-10-22 - Dodavanje turnus_groups_assign validacije

#### Problem: Nedostatak provere važenja turnusa

**Simptom:**
Planning modul je prikazivao i koristio turnuse koji nisu bili važeći za odabrani datum prema `turnus_groups_assign` tabeli.

**Uzrok:**
- `getTurnusiByLineAndDate()` metoda nije imala JOIN sa `turnus_groups_assign`
- `createSchedule()` metoda nije proveravala `date_from` i `date_to` periode važenja
- Mogućnost kreiranja rasporeda sa zastarelim/nevažećim polascima

**Posledica:**
- Frontend prikazivao zastarele turnuse u dropdown-u
- Backend kreirao rasporede sa pogrešnim podacima
- Nekonzistentnost sa admin modulom koji JE proveravao važenje

---

#### Rešenje: JOIN sa turnus_groups_assign i date range filter

**Izmena 1: getTurnusiByLineAndDate() metoda**

**Lokacija:** `/apps/backend/src/planning/planning.service.ts` (linija 85)

**Dodato:**
```sql
INNER JOIN turnus_groups_assign tga ON cct.turnus_id = tga.turnus_id
```

**I filter:**
```sql
AND DATE(${date}) BETWEEN tga.date_from AND tga.date_to
```

---

**Izmena 2: createSchedule() - prvi query (najnoviji turnus_id)**

**Lokacija:** `/apps/backend/src/planning/planning.service.ts` (linija 463)

**Dodato:**
```sql
INNER JOIN turnus_groups_assign tga ON cct.turnus_id = tga.turnus_id
```

**I filter:**
```sql
AND DATE('${dto.date}') BETWEEN tga.date_from AND tga.date_to
```

---

**Izmena 3: createSchedule() - drugi query (dobavljanje polazaka)**

**Lokacija:** `/apps/backend/src/planning/planning.service.ts` (linija 524)

**Dodato:**
```sql
INNER JOIN turnus_groups_assign tga ON cct.turnus_id = tga.turnus_id
```

**I filter:**
```sql
AND DATE(${dto.date}) BETWEEN tga.date_from AND tga.date_to
```

---

#### SQL provera važenja

**Proveri koje turnuse vraća za određeni datum:**
```sql
-- Proveri koje turnuse planning modul vidi za liniju 18 na 2025-10-22:
SELECT DISTINCT
  cct.turnus_id,
  cct.turnus_name,
  tga.date_from,
  tga.date_to,
  CASE
    WHEN '2025-10-22' BETWEEN tga.date_from AND tga.date_to THEN '✅ VAŽEĆI'
    ELSE '❌ ZASTAREO'
  END AS status
FROM changes_codes_tours cct
INNER JOIN turnus_groups_assign tga ON cct.turnus_id = tga.turnus_id
INNER JOIN turnus_days td ON cct.turnus_id = td.turnus_id
INNER JOIN `lines` l ON cct.line_no = l.line_number
WHERE l.line_number_for_display = '18'
  AND td.dayname = 'Sreda'
  AND l.status = 'A'
ORDER BY cct.turnus_name, tga.date_from;
```

**Proveri da li postoje duplikati (isti turnus_name, različiti periodi):**
```sql
SELECT
  cct.turnus_name,
  COUNT(DISTINCT tga.turnus_id) AS broj_verzija,
  GROUP_CONCAT(DISTINCT CONCAT(tga.date_from, ' → ', tga.date_to) ORDER BY tga.date_from SEPARATOR ' | ') AS periodi
FROM changes_codes_tours cct
INNER JOIN turnus_groups_assign tga ON cct.turnus_id = tga.turnus_id
WHERE cct.line_no LIKE '18%'
GROUP BY cct.turnus_name
HAVING broj_verzija > 1;
```

---

#### Uticaj na postojeće funkcionalnosti

**Dnevno planiranje:**
- ✅ Dropdown prikazuje SAMO važeće turnuse za izabrani datum
- ✅ Backend koristi SAMO važeće polaske
- ✅ Konzistentno sa admin modulom

**Mesečno planiranje:**
- ✅ Poziva ažuriran `createSchedule()` za svaki dan
- ✅ Automatski dobija sve popravke
- ✅ Svaki dan u mesecu koristi turnuse važeće ZA TAJ DAN

**Admin modul:**
- ✅ Konzistentnost - planning i admin koriste ISTU logiku važenja

---

### 📅 2025-10-22 - Real-time progress tracking sa Server-Sent Events (SSE)

#### Problem: Progress bar vidljiv samo na kraju obrade

**Simptom:**
- Korisnik pritisne "Kreiraj mesečni raspored"
- Vidi spinner tokom obrade (10+ sekundi)
- Modal sa progress bar-om se otvara tek POSLE završene obrade
- Progress bar je odmah na 100% - nema real-time praćenja napretka

**Uzrok:**
- Originalni endpoint `/monthly-schedule` je sinhron - čeka završetak SVE obrade
- Backend procesuira sve dane u for petlji i vraća rezultat tek na kraju
- Frontend nema pristup napretku TOKOM obrade

**Posledica:**
- Loše korisničko iskustvo - progress bar nema svrhu
- Korisnik ne zna koliko je dana obrađeno dok čeka

---

#### Rešenje: Server-Sent Events (SSE) za real-time streaming

**Dodati fajlovi:**

1. `/apps/backend/src/auth/guards/sse-auth.guard.ts` - Custom guard za SSE
2. `/apps/backend/src/planning/planning.controller.ts` - Novi `@Sse` endpoint
3. `/apps/backend/src/planning/planning.service.ts` - `createMonthlyScheduleStream()` metoda
4. `/apps/admin-portal/src/services/planning.service.ts` - `createMonthlyScheduleStream()` klijent
5. `/apps/admin-portal/src/pages/transport/planning/components/MonthlyScheduleForm.tsx` - EventSource integracija

---

#### Implementacija: Backend SSE endpoint

**Lokacija:** `/apps/backend/src/planning/planning.controller.ts` (linija 159-197)

**Endpoint:**
```typescript
@Sse('monthly-schedule-stream')
@UseGuards(SseAuthGuard, PermissionsGuard)
createMonthlyScheduleStream(@Query() params, @Req() req): Observable<MessageEvent>
```

**Ključne karakteristike:**
- **SSE** umesto POST - jednosmerni streaming sa servera ka klijentu
- **SseAuthGuard** - prihvata token iz query string-a (EventSource ne podržava custom headers)
- **Observable** - RxJS stream koji emituje events tokom obrade

---

#### Streaming servisna metoda

**Lokacija:** `/apps/backend/src/planning/planning.service.ts` (linija 1583-1789)

**Metoda:** `createMonthlyScheduleStream(dto, userId): Observable<MessageEvent>`

**Event tipovi:**

1. **'progress'** - posle obrade svakog dana
```typescript
{
  type: 'progress',
  current: 5,      // broj obrađenih dana
  total: 30,       // ukupno dana
  status: 'processing',
  results: [...]   // svi rezultati do sada
}
```

2. **'conflict'** - kada vozač već ima rasporede
```typescript
{
  type: 'conflict',
  conflict: {
    hasConflict: true,
    conflictDates: ['2025-11-05', '2025-11-12'],
    conflictCount: 2
  },
  totalDays: 30
}
```

3. **'complete'** - na kraju obrade
```typescript
{
  type: 'complete',
  totalDays: 30,
  processedDays: 30,
  successCount: 28,
  errorCount: 2,
  results: [...]
}
```

---

#### SSE autentifikacija

**Problem:** EventSource API ne podržava custom headers (Authorization: Bearer token)

**Rešenje:** Custom `SseAuthGuard`

**Lokacija:** `/apps/backend/src/auth/guards/sse-auth.guard.ts`

**Logika:**
1. Proveri da li postoji `token` u query parametru
2. Ako postoji → postavi ga u `Authorization` header
3. Pozovi parent `AuthGuard('jwt')` da verifikuje token

**Korišćenje:**
```
GET /api/planning/monthly-schedule-stream?month=11&year=2025&...&token=xxx
```

---

#### Frontend EventSource integracija

**Lokacija:** `/apps/admin-portal/src/services/planning.service.ts` (linija 180-233)

**Metoda:** `createMonthlyScheduleStream(data, onProgress, onComplete, onError)`

**Parametri:**
- `data` - DTO sa parametrima
- `onProgress` - callback za svaki progress event
- `onComplete` - callback za complete/conflict event
- `onError` - callback za greške

**Primer:**
```typescript
const eventSource = planningService.createMonthlyScheduleStream(
  dto,
  (data) => {
    // Update progress bar: data.current / data.total
    setProgressData(data);
  },
  (data) => {
    // Handle completion ili conflict
    if (data.type === 'complete') {
      message.success('Završeno!');
    }
  },
  (error) => {
    message.error('Greška!');
  }
);

// Cleanup
eventSource.close();
```

---

#### React komponenta sa EventSource

**Lokacija:** `/apps/admin-portal/src/pages/transport/planning/components/MonthlyScheduleForm.tsx`

**Ključne izmene:**

1. **State za EventSource:**
```typescript
const [eventSource, setEventSource] = useState<EventSource | null>(null);
```

2. **Cleanup effect:**
```typescript
useEffect(() => {
  return () => {
    if (eventSource) {
      eventSource.close();
    }
  };
}, [eventSource]);
```

3. **Streaming funkcija umesto običnog POST:**
```typescript
const startMonthlyScheduleStream = (conflictResolution?) => {
  // Otvori progress modal ODMAH (prazna progress bar)
  setProgressModalVisible(true);
  setProgressData({ current: 0, total: 0, status: 'processing', results: [] });

  // Pokreni streaming
  const source = planningService.createMonthlyScheduleStream(
    dto,
    (data) => setProgressData(data),  // Real-time update!
    (data) => handleComplete(data),
    (error) => handleError(error)
  );

  setEventSource(source);
};
```

---

#### Rezultat: Real-time UX

**Tok izvršavanja:**

1. Korisnik pritisne "Kreiraj mesečni raspored"
2. Spinner se prikazuje u dugmetu
3. **Progress modal se otvara ODMAH** sa progress bar-om na 0%
4. **Progress bar se ažurira TOKOM obrade:**
   - Dan 1/30 obrađen → progress bar 3%
   - Dan 5/30 obrađen → progress bar 17%
   - Dan 30/30 obrađen → progress bar 100%
5. Prikazuje se lista obrađenih dana u realnom vremenu
6. Na kraju se prikazuje "OK" dugme za zatvaranje

**Poboljšanja:**
- ✅ Korisnik vidi napredak TOKOM obrade
- ✅ Lista rezultata se popunjava uživo
- ✅ Jasno je koliko dana je obrađeno / ostalo
- ✅ Bolje korisničko iskustvo tokom dugih operacija (10+ sekundi)

---

#### Tehničke napomene

**EventSource vs WebSocket:**
- EventSource korišćen jer je jednosmeran stream (server → klijent)
- Jednostavniji od WebSocket-a za ovaj use case
- Browser automatski radi reconnect ako veza padne

**Performanse:**
- Svaki progress event je ~1-2KB JSON-a
- Za 30 dana = 30 event-a = ~30-60KB total
- Minimalan overhead u odnosu na sinhron pristup

**Backward compatibility:**
- Originalni `/monthly-schedule` POST endpoint i dalje postoji
- Može se koristiti za non-streaming use case-ove
- Frontend koristi SSE endpoint za bolji UX

---

## 🔄 Različiti turnusi za Subotu i Nedelju

**Datum implementacije:** 2025-10-22

### Funkcionalnost

Pri kreiranju mesečnog rasporeda, omogućeno je korišćenje **različitih turnusa za Subotu i Nedelju** umesto globalnog turnusa.

**Use case:** Linija 18 može imati turnus `00018-1` radnim danima, ali koristi `00018-8` Subotom i `00018-12` Nedeljom.

### Frontend

**Lokacija:** `MonthlyScheduleForm.tsx`

**UI elementi:**
- **Dropdown "Broj Turaže"** pored Subota i Nedelja checkbox-a
- Lazy loading turnusa na focus
- Prikazuje format: `turnus_name (N polazaka)` - npr. "00018-8 (42 polazaka)"

**API poziv:**
```typescript
getTurageOptions({
  lineNumber: '18',
  turnusName: '00018-1',  // globalni turnus (ne koristi se za filter!)
  shiftNumber: 1,
  dayOfWeek: 'Subota'  // ili 'Nedelja'
})
```

**Dropdown logika:**
- Prikazuje **SVE dostupne turnuse** za liniju i dan (ne samo trenutni!)
- Filtrira po smeni (pokazuje samo turnuse sa istom smenom)
- Ako je prazan → koristi globalni turnus

### Backend DTO

**Lokacija:** `create-monthly-schedule.dto.ts`

**Nova polja:**
```typescript
@IsOptional()
@IsString()
saturdayTurnusName?: string;  // npr. "00018-8"

@IsOptional()
@IsString()
sundayTurnusName?: string;    // npr. "00018-12"
```

### Backend logika

**Lokacija:** `planning.service.ts → createMonthlyScheduleStream()`

**Validacija:**
1. Pronalazi `saturdayTurnusId` i `sundayTurnusId` iz `turnusiForLine` liste
2. Proverava da li turnusi postoje
3. Proverava da li turnusi saobraćaju odgovarajućim danima (turnus_days tabela)

**Primena:**
```typescript
for (const date of datesToProcess) {
  const dayOfWeek = date.getDay(); // 0=Nedelja, 6=Subota

  let turnusIdForDate = turnusId; // Default: globalni

  if (dayOfWeek === 6 && saturdayTurnusId) {
    turnusIdForDate = saturdayTurnusId;
  } else if (dayOfWeek === 0 && sundayTurnusId) {
    turnusIdForDate = sundayTurnusId;
  }

  await createSchedule({ ..., turnusId: turnusIdForDate });
}
```

**Ključne karakteristike:**
- **Opciono** - ako nije odabran, koristi globalni turnus
- **Isti vozač** - primenjuje se za sve dane (i sa različitim turnusima)
- **Ista smena** - dropdown prikazuje samo turnuse sa odabranom smenom
- **Dan validacija** - backend proverava `turnus_days` tabelu

---

## 📌 Zaključak

**"Raspored"** je kompleksna funkcija sa:
- **9 baza tabela** (date_travel_order, changes_codes_tours, turnus_days, lines, users, ...)
- **Dual-write** strategija (Smart City + legacy)
- **Smart form reset** logika
- **Natural sort** za turnuse
- **Sistem preporuka** vozača (confidence score)
- **UTC timezone** handling za MySQL TIME polja

**Ključne tabele:**
- `date_travel_order` - glavna tabela (jeden zapis = jeden polazak)
- `changes_codes_tours` - definicija turnusa i polazaka
- `turnus_default_per_driver` - preporuke vozača

**Ključna logika:**
- Kreiranje **svih polazaka** za turnus/smenu odjednom
- Grupisanje po `turnus_name` (NE `turnus_id`!)
- Pronalaženje **najnovijeg turnus_id** po MAX(change_time)
- **Smart form reset** - automatski prelaz na sledeću smenu/turnus

---

**Autor dokumentacije:** Claude Code
**Datum kreiranja:** 2025-10-22
**Poslednje ažuriranje:** 2025-10-22 (Saturday/Sunday turnusi + SSE streaming)
**Za pitanja:** Konsultuj /claude-tips.md i ovaj fajl
