# Turnus Default Per Driver - Sistem Dokumentacija

**Verzija:** 1.0
**Datum:** 2025-10-16
**Status:** U razvoju

## 📋 Pregled

Sistem za definisanje i automatsku sugestiju default turnusa po vozaču. Omogućava planeru da brže dodeljuje turnuse vozačima na osnovu istorijskih podataka i manuelnih podešavanja.

---

## 🎯 Ciljevi Sistema

1. **Ubrzanje planiranja** - Automatski predlog turnusa na osnovu istorije
2. **Fleksibilnost** - Podrška za različite nivoe specifičnosti (linija, dan, smena)
3. **Istorijska analiza** - Analiza podataka iz legacy i naše baze
4. **Inteligentno matching** - Sistem prioriteta za pronalaženje najboljeg match-a

---

## 🗄️ Struktura Tabele

### SQL Kreiranje Tabele

```sql
CREATE TABLE turnus_default_per_driver (
  -- Primarni ključ
  id INT PRIMARY KEY AUTO_INCREMENT,

  -- Veza sa vozačem
  driver_id INT NOT NULL,

  -- Identifikacija turnusa (koristi turnusName jer je stabilan)
  turnus_name VARCHAR(50) NOT NULL COMMENT 'Naziv turnusa (npr. "00018-1")',

  -- Opcioni filteri za specifičnije podešavanje
  line_number_for_display VARCHAR(10) NULL COMMENT 'NULL = važi za sve linije, ili specifična linija',
  shift_number TINYINT NULL COMMENT 'NULL = sve smene, 1/2/3 = specifična smena',
  day_of_week ENUM('Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja') NULL COMMENT 'NULL = svi dani',

  -- Prioritet (manji broj = viši prioritet) za razrešavanje konflikata
  priority INT NOT NULL DEFAULT 100 COMMENT 'Automatski izračunat na osnovu specifičnosti',

  -- Status
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Da li je default aktivan',

  -- Statistika (popunjava se iz analize istorije)
  usage_count INT DEFAULT 0 COMMENT 'Koliko puta je vozač vozio ovaj turnus',
  usage_percentage DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Procenat od ukupnih vožnji',
  last_used_date DATE NULL COMMENT 'Poslednji put kada je korišćen',

  -- Auto-generated flag
  auto_generated BOOLEAN DEFAULT FALSE COMMENT 'Da li je kreiran automatski iz analize',
  confidence_score DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Stepen poverenja (0-100)',

  -- Napomena/razlog (opciono)
  note TEXT NULL COMMENT 'Komentar administratora',

  -- Audit polja
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  updated_by INT,

  -- Foreign keys
  FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

  -- Sprečavanje duplikata
  UNIQUE KEY unique_driver_turnus_config (
    driver_id,
    turnus_name,
    COALESCE(line_number_for_display, ''),
    COALESCE(shift_number, 0),
    COALESCE(day_of_week, '')
  ),

  -- Indeksi za brže pretraživanje
  INDEX idx_driver_active (driver_id, is_active),
  INDEX idx_turnus_lookup (turnus_name, line_number_for_display),
  INDEX idx_priority (priority),
  INDEX idx_auto_generated (auto_generated, confidence_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 🎚️ Sistem Prioriteta (8 Nivoa Specifičnosti)

Sistem automatski izračunava prioritet na osnovu specifičnosti. **Manji broj = viši prioritet = jači match.**

### Nivoi Prioriteta

| Nivo | Priority | Turnus | Linija | Smena | Dan | Opis |
|------|----------|--------|--------|-------|-----|------|
| **1** | 10 | ✅ | ✅ | ✅ | ✅ | Najspecifičniji - sve 4 dimenzije |
| **2** | 30 | ✅ | ✅ | ✅ | ❌ | Linija + Smena (bilo koji dan) |
| **3** | 50 | ✅ | ✅ | ❌ | ✅ | Linija + Dan (bilo koja smena) |
| **4** | 70 | ✅ | ❌ | ✅ | ✅ | Smena + Dan (bilo koja linija) |
| **5** | 100 | ✅ | ✅ | ❌ | ❌ | Samo Linija (bilo koji dan/smena) |
| **6** | 120 | ✅ | ❌ | ✅ | ❌ | Samo Smena (bilo koja linija/dan) |
| **7** | 140 | ✅ | ❌ | ❌ | ✅ | Samo Dan (bilo koja linija/smena) |
| **8** | 200 | ✅ | ❌ | ❌ | ❌ | Najopštiji - samo turnus |

### Algoritam za Izračunavanje Prioriteta

```javascript
function calculatePriority(config) {
  const hasLine = config.line_number_for_display !== null;
  const hasShift = config.shift_number !== null;
  const hasDay = config.day_of_week !== null;

  // Level 1: Sve 4 dimenzije (turnus uvek postoji)
  if (hasLine && hasShift && hasDay) return 10;

  // Level 2: Linija + Smena
  if (hasLine && hasShift && !hasDay) return 30;

  // Level 3: Linija + Dan
  if (hasLine && !hasShift && hasDay) return 50;

  // Level 4: Smena + Dan
  if (!hasLine && hasShift && hasDay) return 70;

  // Level 5: Samo Linija
  if (hasLine && !hasShift && !hasDay) return 100;

  // Level 6: Samo Smena
  if (!hasLine && hasShift && !hasDay) return 120;

  // Level 7: Samo Dan
  if (!hasLine && !hasShift && hasDay) return 140;

  // Level 8: Samo Turnus (fallback)
  return 200;
}
```

---

## 📊 Algoritam za Matching

Kada planer bira vozača za određeni turnus na određenoj liniji, dan i smenu, sistem pronalazi **najbolji match** korišenjem sledećeg algoritma:

### SQL Query za Pronalaženje Best Match-a

```sql
SELECT
  id,
  turnus_name,
  line_number_for_display,
  shift_number,
  day_of_week,
  priority,
  usage_count,
  usage_percentage,
  confidence_score
FROM turnus_default_per_driver
WHERE driver_id = :driverId
  AND turnus_name = :turnusName
  AND is_active = TRUE
  AND (
    -- Exact match ili NULL (znači "bilo koji")
    (line_number_for_display = :lineNumber OR line_number_for_display IS NULL)
    AND (shift_number = :shiftNumber OR shift_number IS NULL)
    AND (day_of_week = :dayOfWeek OR day_of_week IS NULL)
  )
ORDER BY
  priority ASC,           -- Najspecifičniji prvi
  confidence_score DESC,  -- Veći confidence ako isti priority
  usage_count DESC        -- Više korišćenja ako isti confidence
LIMIT 1;
```

### Primeri Matching-a

#### Scenario 1: Potpuni Match
```
Traženi: Linija 18, Turnus 00018-1, Smena 1, Ponedeljak
Database:
  - [Priority 10] Linija 18, Turnus 00018-1, Smena 1, Ponedeljak ✅ MATCH!
  - [Priority 30] Linija 18, Turnus 00018-1, Smena 1, bilo koji dan
  - [Priority 100] Linija 18, Turnus 00018-1, bilo koja smena, bilo koji dan

Rezultat: Priority 10 (najspecifičniji)
```

#### Scenario 2: Parcijalni Match
```
Traženi: Linija 19, Turnus 00019-1, Smena 2, Utorak
Database:
  - [Priority 100] Linija 19, Turnus 00019-1, bilo koja smena, bilo koji dan ✅ MATCH!
  - [Priority 200] Turnus 00019-1, bilo koja linija, smena, dan

Rezultat: Priority 100 (specifičniji od 200)
```

#### Scenario 3: Fallback na Opšti
```
Traženi: Linija 20, Turnus 00020-1, Smena 3, Subota
Database:
  - [Priority 200] Turnus 00020-1, bilo koja linija, smena, dan ✅ MATCH!

Rezultat: Priority 200 (jedini dostupan)
```

---

## 📈 Analiza Istorijskih Podataka

### Izvori Podataka

1. **Legacy Baza** (`date_travel_order`) - Prošli podaci
2. **Naša Baza** (`date_travel_order`) - Novi podaci

### SQL Query za Analizu iz Naše Baze

```sql
SELECT
  driver_id,
  -- Ekstrahuj turnus_name iz comment polja (format: "Turnus: 00018-1, Smena: 1, ...")
  TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(comment, 'Turnus: ', -1), ',', 1)) AS turnus_name,

  -- Ekstrahuj shift_number
  CAST(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(comment, 'Smena: ', -1), ',', 1)) AS UNSIGNED) AS shift_number,

  line_no AS line_number,
  DAYNAME(start_date) AS day_of_week_en,

  -- Mapiranje na srpske nazive dana
  CASE DAYNAME(start_date)
    WHEN 'Monday' THEN 'Ponedeljak'
    WHEN 'Tuesday' THEN 'Utorak'
    WHEN 'Wednesday' THEN 'Sreda'
    WHEN 'Thursday' THEN 'Četvrtak'
    WHEN 'Friday' THEN 'Petak'
    WHEN 'Saturday' THEN 'Subota'
    WHEN 'Sunday' THEN 'Nedelja'
  END AS day_of_week_sr,

  COUNT(*) AS usage_count,
  MIN(start_date) AS first_used,
  MAX(start_date) AS last_used
FROM date_travel_order
WHERE comment LIKE 'Turnus:%'
  AND start_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)  -- Poslednjih 6 meseci
GROUP BY
  driver_id,
  turnus_name,
  shift_number,
  line_no,
  day_of_week_sr
HAVING usage_count >= 3  -- Minimum 3 puta da se računa
ORDER BY driver_id, usage_count DESC;
```

### SQL Query za Legacy Bazu

```sql
-- Slično kao gore, samo što legacy baza može imati drugačiju strukturu comment-a
-- Potrebno je prilagoditi regex/parsing u zavisnosti od legacy formata
```

### Algoritam za Auto-Generisanje Defaults-a

```python
def analyze_and_suggest_defaults(driver_id, min_usage_count=5, min_confidence=70):
    """
    Analizira istoriju vozača i predlaže defaults

    Args:
        driver_id: ID vozača
        min_usage_count: Minimalan broj korišćenja da se računa
        min_confidence: Minimalan procenat da se predloži kao default (0-100)

    Returns:
        List of suggested defaults
    """

    # 1. Dobavi sve kombinacije turnusa koje je vozač vozio
    history = fetch_driver_history(driver_id)

    # 2. Grupiši po specifičnosti (od najspecifičnije ka najopštijoj)
    grouped = {
        'level1': [],  # turnus + linija + smena + dan
        'level2': [],  # turnus + linija + smena
        'level3': [],  # turnus + linija + dan
        'level4': [],  # turnus + smena + dan
        'level5': [],  # turnus + linija
        'level6': [],  # turnus + smena
        'level7': [],  # turnus + dan
        'level8': []   # samo turnus
    }

    for combo in history:
        # Izračunaj confidence score
        total_occurrences = combo.usage_count
        total_possible = count_total_opportunities(driver_id, combo.constraints)
        confidence = (total_occurrences / total_possible) * 100 if total_possible > 0 else 0

        # Ako je confidence dovoljno visok, predloži kao default
        if confidence >= min_confidence and total_occurrences >= min_usage_count:
            level = determine_specificity_level(combo)
            grouped[level].append({
                'turnus_name': combo.turnus_name,
                'line_number': combo.line_number,
                'shift_number': combo.shift_number,
                'day_of_week': combo.day_of_week,
                'priority': calculate_priority(combo),
                'usage_count': total_occurrences,
                'confidence_score': confidence,
                'auto_generated': True
            })

    # 3. Eliminiši redundantne defaults
    # Ako postoji Level 1 (najspecifičniji), ne treba Level 8 (najopštiji) za isti turnus
    suggestions = remove_redundant_defaults(grouped)

    return suggestions
```

### Threshold-i za Auto-Generisanje

| Metrika | Threshold | Opis |
|---------|-----------|------|
| `min_usage_count` | 5 | Minimum 5 puta korišćen |
| `min_confidence` | 70% | Minimum 70% od svih prilika |
| `analysis_period` | 6 meseci | Analizira poslednjih 6 meseci |
| `max_auto_defaults` | 10 | Maksimum 10 auto defaults po vozaču |

---

## 🔧 Backend Implementacija

### Prisma Model

```prisma
model TurnusDefaultPerDriver {
  id                  Int       @id @default(autoincrement())
  driverId            Int       @map("driver_id")
  turnusName          String    @map("turnus_name") @db.VarChar(50)
  lineNumberForDisplay String?  @map("line_number_for_display") @db.VarChar(10)
  shiftNumber         Int?      @map("shift_number") @db.TinyInt
  dayOfWeek           DayOfWeek? @map("day_of_week")
  priority            Int       @default(100)
  isActive            Boolean   @default(true) @map("is_active")
  usageCount          Int       @default(0) @map("usage_count")
  usagePercentage     Decimal   @default(0.00) @map("usage_percentage") @db.Decimal(5, 2)
  lastUsedDate        DateTime? @map("last_used_date") @db.Date
  autoGenerated       Boolean   @default(false) @map("auto_generated")
  confidenceScore     Decimal   @default(0.00) @map("confidence_score") @db.Decimal(5, 2)
  note                String?   @db.Text
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  createdBy           Int?      @map("created_by")
  updatedBy           Int?      @map("updated_by")

  driver              User      @relation("DriverDefaults", fields: [driverId], references: [id], onDelete: Cascade)
  creator             User?     @relation("DefaultCreator", fields: [createdBy], references: [id], onDelete: SetNull)
  updater             User?     @relation("DefaultUpdater", fields: [updatedBy], references: [id], onDelete: SetNull)

  @@unique([driverId, turnusName, lineNumberForDisplay, shiftNumber, dayOfWeek], name: "unique_driver_turnus_config")
  @@index([driverId, isActive])
  @@index([turnusName, lineNumberForDisplay])
  @@index([priority])
  @@index([autoGenerated, confidenceScore])
  @@map("turnus_default_per_driver")
}

enum DayOfWeek {
  Ponedeljak
  Utorak
  Sreda
  Četvrtak
  Petak
  Subota
  Nedelja
}
```

### API Endpoints

```typescript
// Analiza istorije vozača
GET /api/planning/driver-defaults/analyze/:driverId
Query params:
  - months?: number (default: 6)
  - minUsage?: number (default: 5)
Response: { statistics: [...], suggestions: [...] }

// Automatski predlozi za vozača
GET /api/planning/driver-defaults/suggest/:driverId
Query params:
  - minConfidence?: number (default: 70)
Response: { suggestions: [...] }

// Dobavi defaults za vozača
GET /api/planning/driver-defaults
Query params:
  - driverId: number (required)
  - isActive?: boolean
  - autoGenerated?: boolean
Response: { defaults: [...] }

// Pronađi best match
GET /api/planning/driver-defaults/match
Query params:
  - driverId: number
  - turnusName: string
  - lineNumber?: string
  - shiftNumber?: number
  - dayOfWeek?: string
Response: { match: {...} | null }

// Kreiranje novog default-a
POST /api/planning/driver-defaults
Body: CreateTurnusDefaultDto
Response: { default: {...} }

// Ažuriranje
PATCH /api/planning/driver-defaults/:id
Body: UpdateTurnusDefaultDto
Response: { default: {...} }

// Brisanje
DELETE /api/planning/driver-defaults/:id
Response: { success: true }

// Bulk kreiranje (iz automatskih predloga)
POST /api/planning/driver-defaults/bulk
Body: { suggestions: [...] }
Response: { created: number, skipped: number, errors: [...] }
```

---

## 🎨 Frontend Integracija

### 1. Nova Stranica: Driver Defaults Management

**Ruta:** `/transport/planning/driver-defaults`

**Funkcionalnosti:**
- Tabela svih vozača sa brojem defaults-a
- Dugme "Analiziraj istoriju" za svakog vozača
- Modal sa predlozima (confidence score, usage count)
- Opcija da se prihvate svi ili pojedinačno
- Forma za manuelno dodavanje
- Pregled postojećih defaults-a sa edit/delete

### 2. Integracija u DriverSelectionModal

**Izmene:**
- Prikazati vozače sa default turnus-om sa zelenom zvezdom ⭐
- Auto-suggest pri otvaranju modal-a (ako postoji match)
- Tooltip: "Default za ovog vozača (korišćeno 15 puta, confidence 85%)"
- Filter opcija: "Prikaži samo vozače sa default-om"

**Primer UI:**
```
┌─────────────────────────────────────────────────┐
│ Izbor vozača                                    │
│ Linija 18 • 00018-1 • Smena 1 • 04:00 - 12:00 │
├─────────────────────────────────────────────────┤
│ 🔍 Pretraži vozače...                          │
│                                                  │
│ ✅ Slobodni vozači (23)                        │
│ ┌─────────────────────────────────────────────┐│
│ │ ⭐ Marko Marković (default za ovu liniju)   ││
│ │ │  Ana Anić                                  ││
│ │ │  Petar Petrović                           ││
│ └─────────────────────────────────────────────┘│
│                                                  │
│ ❌ Zauzeti vozači (5)                          │
└─────────────────────────────────────────────────┘
```

---

## 📝 Primeri Korišćenja

### Primer 1: Vozač uvek vozi isti turnus na istoj liniji

```sql
INSERT INTO turnus_default_per_driver
(driver_id, turnus_name, line_number_for_display, priority, usage_count, confidence_score, created_by)
VALUES
(123, '00018-1', '18', 100, 45, 92.5, 1);
```

**Značenje:** Vozač 123 uvek vozi turnus "00018-1" na liniji 18 (bilo koja smena, bilo koji dan). Korišćeno 45 puta sa 92.5% confidence.

### Primer 2: Vozač vozi samo ponedeljkom

```sql
INSERT INTO turnus_default_per_driver
(driver_id, turnus_name, day_of_week, priority, usage_count, confidence_score, auto_generated, created_by)
VALUES
(124, '00019-2', 'Ponedeljak', 140, 22, 88.0, TRUE, NULL);
```

**Značenje:** Vozač 124 vozi turnus "00019-2" samo ponedeljkom (bilo koja linija, bilo koja smena). Auto-generirano iz analize.

### Primer 3: Najspecifičniji default

```sql
INSERT INTO turnus_default_per_driver
(driver_id, turnus_name, line_number_for_display, shift_number, day_of_week, priority, usage_count, confidence_score, note, created_by)
VALUES
(125, '00020-1', '20', 1, 'Utorak', 10, 18, 100.0, 'Ekskluzivni vozač za ovu rutu', 1);
```

**Značenje:** Vozač 125 **UVEK** vozi turnus "00020-1" na liniji 20, prvu smenu, utorkom. Confidence 100% (18/18 puta).

---

## ⚙️ Konfiguracija i Podešavanja

### Environment Variables

```env
# Threshold za automatsko kreiranje defaults-a
TURNUS_DEFAULT_MIN_USAGE=5
TURNUS_DEFAULT_MIN_CONFIDENCE=70
TURNUS_DEFAULT_ANALYSIS_MONTHS=6
TURNUS_DEFAULT_MAX_AUTO=10
```

### System Settings (baza)

| Key | Value | Description |
|-----|-------|-------------|
| `turnus_default_enabled` | `true` | Da li je feature aktivan |
| `turnus_default_auto_suggest` | `true` | Automatski predlaži u modalu |
| `turnus_default_show_confidence` | `true` | Prikaži confidence score u UI |

---

## 🚀 Future Enhancements

1. **Machine Learning Predviđanje**
   - Treniraj model na istorijskim podacima
   - Predvidi ko će voziti šta sledećeg meseca

2. **Optimizacija Rasporeda**
   - Automatski generiši raspored za celu nedelju
   - Poštuj defaults i balansiraj opterećenje

3. **Konflikt Detekcija**
   - Upozori ako dva vozača imaju default za isti turnus
   - Predloži alternativne vozače

4. **Reporting**
   - Koliko defaults-a se zaista koristi
   - Top 10 najčešćih kombinacija vozač-turnus

5. **Import/Export**
   - Izvezi defaults za backup
   - Importuj iz Excel-a

---

## 📚 Dodatni Resursi

- **Prisma Dokumentacija:** https://www.prisma.io/docs
- **NestJS Best Practices:** https://docs.nestjs.com/
- **MySQL ENUM Type:** https://dev.mysql.com/doc/refman/8.0/en/enum.html

---

**Kraj dokumenta**