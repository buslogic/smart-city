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
- `deleteSchedule(id, startDate)` → DELETE `/api/planning/schedule/:id/:startDate`

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
| DELETE | `/planning/schedule/:id/:startDate` | `transport.planning.schedule:delete` | Obriši raspored |

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

**`deleteFromLegacySchedule()` - Linija 1110-1144**
```typescript
// DELETE FROM date_shedule WHERE:
// - line_no, start_date, user_1_id_planned
// - tour_id IN (SELECT turnus_id WHERE turnus_name + shift_number)
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
**Datum:** 2025-10-22
**Za pitanja:** Konsultuj /claude-tips.md i ovaj fajl
