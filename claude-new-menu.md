

# Vodič za dodavanje nove opcije menija u Smart City Admin Portal

## 🎯 KLJUČNA PRAVILA (pročitaj PRE početka!)

### ⚠️ MenuOrder brojevi - NIKAD NE POMERAJ postojeće!
- ✅ **Koristi "između" brojeve**: 301500000000 između 301 i 302
- ❌ **NE POMERAJ** postojeće menuOrder brojeve
- 💡 **Zbog toga smo ostavili velike razmake** - da možemo dodavati između!

### ⚠️ Format permisija - DVOTAČKA pre akcije!
- ✅ `transport.administration:view` (ISPRAVNO)
- ❌ `transport.administration.view` (POGREŠNO)

### ⚠️ SQL kolone - snake_case OBAVEZNO!
- ✅ `menu_order`, `description_sr`, `updated_at` (ISPRAVNO)
- ❌ `menuOrder`, `descriptionSr`, `updatedAt` (POGREŠNO)

---

## 📋 BRZI PREGLED - 6 KORAKA

1. **KORAK 1:** Odredi menuOrder broj (IZMEĐU postojećih!)

2. **KORAK 2:** Kreiraj Prisma migraciju sa permisijama
   - Koristi snake_case kolone
   - Dodaj sve CRUD permisije odjednom

3. **KORAK 3:** Pokreni migraciju i dodeli SUPER_ADMIN roli

4. **KORAK 4:** Dodaj opciju u ModernMenu.tsx

5. **KORAK 5:** Ažuriraj PermissionsTree getMenuName() mapiranje

6. **KORAK 6:** Kreiraj stranicu i dodaj rutu u App.tsx

## ⚠️ VAŽNO: Konvencija imenovanja permisija

### OBAVEZNO koristiti DVOTAČKU (:) na KRAJU između resursa i akcije

**✅ ISPRAVNO FORMAT:**
```
[modul].[resurs]:[akcija]
```

**✅ ISPRAVNI PRIMERI:**
- `maintenance.timescaledb:view`
- `dashboard.widgets.gps:view` 
- `settings.general:read`
- `legacy_sync:manage`
- `vehicles:read`
- `dispatcher:sync_gps`

**❌ POGREŠNO:**
- `maintenance.timescaledb.view` (koristi tačku umesto dvotačke pre akcije)
- `maintenance:timescaledb:view` (previše dvotačaka)

### Detaljno objašnjenje formata:
- Koristi **TAČKU (.)** za separaciju modula i pod-modula
- Koristi **DVOTAČKU (:)** SAMO pre finalne akcije

Primeri:
- `maintenance.timescaledb:view` - modul: maintenance, resurs: timescaledb, akcija: view
- `dashboard.widgets.vehicles:view` - modul: dashboard, pod-modul: widgets, resurs: vehicles, akcija: view
- `settings:read` - resurs: settings, akcija: read
- `vehicles:create` - resurs: vehicles, akcija: create

### Standardne akcije:
- `view` ili `read` - pregled
- `create` - kreiranje
- `update` ili `edit` - izmena
- `delete` - brisanje
- `manage` - potpuno upravljanje

---

## 🔢 MenuOrder Struktura i Pravila

### Kako funkcioniše menuOrder?

MenuOrder je **12-cifreni broj** koji određuje poziciju i nivo u hijerarhiji:
```
XXYYZZ000000
││││││
││││└└─ Fine-grained sorting (4 cifre - ne koristimo)
││└└─── Treći nivo (ZZ) - opcije unutar grupe
└└───── Drugi nivo (YY) - grupe unutar glavnog menija
```

### Glavni nivoi (prvi par XX):
- **10** (100000000000) - Dashboard
- **20** (200000000000) - Korisnici
- **30** (300000000000) - Autobuski Prevoznici (Transport)
- **40** (400000000000) - Podešavanje

### Drugi nivo - Autobuski Prevoznici (3Y):
- **301000000000** - Vozila
- **301500000000** - Administracija (NOVI - IZMEĐU!)
- **302000000000** - Dispečerski Modul
- **303000000000** - Bezbednost
- **304000000000** - Održavanje

### Treći nivo - Vozila (301Z):
- **301010000000** - Lista Vozila
- **301020000000** - Sinhronizacija
- **301030000000** - GPS Real-Time Sync
- itd.

### 🎯 Pravilo za određivanje novog broja:

1. **Pronađi gde želiš da ubaciš opciju**
2. **Pogledaj susedne brojeve**
3. **Uzmi "između" vrednost**

**Primer:**
- Vozila = **301000000000**
- Dispečerski = **302000000000**
- Nova grupa između? = **301500000000** ✅

### ⚠️ Zašto string slicing logika radi?

PermissionsTree koristi **string slicing** (ne Math.floor):
```typescript
// STARA logika (ne radi sa "između" brojevima):
Math.floor(301500000000 / 1000000000) = 301 ❌

// NOVA logika (string slicing - radi savršeno):
"301500000000".substring(0, 4) = "3015" ✅
"301000000000".substring(0, 4) = "3010" ✅
```

Svaki par cifara je **jedinstveni grupirajući ključ**!

---

## KORAK 1: Odredi menuOrder brojeve

**Primer: Dodavanje "Administracija" grupe sa "Centralne tačke" opcijom**

### 1.1 Proveri postojeće brojeve
```bash
docker exec smartcity-mysql-local mysql -u smartcity_user -pSecurePassword123! smartcity_dev -e "SELECT menu_order, name, resource FROM permissions WHERE menu_order >= 301000000000 AND menu_order < 303000000000 ORDER BY menu_order LIMIT 20;"
```

### 1.2 Odredi nove brojeve

Želiš da **"Administracija"** bude između **"Vozila"** (301) i **"Dispečerski"** (302):

- **Administracija grupa**: 301500000000 (301.5 - IZMEĐU!)
- **Centralne tačke - view**: 301510000000
- **Centralne tačke - create**: 301510000001
- **Centralne tačke - update**: 301510000002
- **Centralne tačke - delete**: 301510000003

---

## KORAK 2: Kreiranje Prisma migracije

### 2.1 Kreiraj folder za migraciju
```bash
# Generiši timestamp
date +"%Y%m%d%H%M%S"
# Npr: 20251007071814

mkdir -p /home/kocev/smart-city/apps/backend/prisma/migrations/20251007071814_add_administration_central_points_permissions
```

### 2.2 Kreiraj migration.sql fajl

**Fajl:** `migrations/20251007071814_add_administration_central_points_permissions/migration.sql`

```sql
-- Add administration and central points permissions

-- 1. Grupa "Administracija" - pristup podmeniju
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration:view',
  'transport.administration',
  'view',
  'Access to administration submenu',
  'Pristup podmeniju administracija',
  'transport',
  301500000000,
  NOW()
);

-- 2. Centralne tačke - VIEW permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points:view',
  'transport.administration.central_points',
  'view',
  'View central points',
  'Pregled centralnih tačaka',
  'transport',
  301510000000,
  NOW()
);

-- 3. Centralne tačke - CREATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points:create',
  'transport.administration.central_points',
  'create',
  'Create central points',
  'Kreiranje centralnih tačaka',
  'transport',
  301510000001,
  NOW()
);

-- 4. Centralne tačke - UPDATE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points:update',
  'transport.administration.central_points',
  'update',
  'Update central points',
  'Izmena centralnih tačaka',
  'transport',
  301510000002,
  NOW()
);

-- 5. Centralne tačke - DELETE permisija
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points:delete',
  'transport.administration.central_points',
  'delete',
  'Delete central points',
  'Brisanje centralnih tačaka',
  'transport',
  301510000003,
  NOW()
);
```

**⚠️ VAŽNO:**
- Koristi **snake_case** za kolone: `menu_order`, `description_sr`, `updated_at`
- Koristi **DVOTAČKU** u name: `transport.administration:view`
- **NE dodavaj** permisije rolama u migraciji - to se radi posle!

---

## KORAK 3: Pokreni migraciju i dodeli permisije

### 3.1 Primeni migraciju
```bash
cd /home/kocev/smart-city/apps/backend
npx prisma migrate deploy
```

### 3.2 Proveri da li su permisije ubačene
```bash
docker exec smartcity-mysql-local mysql -u smartcity_user -pSecurePassword123! smartcity_dev -e "SELECT id, name, resource, menu_order, description_sr FROM permissions WHERE resource LIKE 'transport.administration%' ORDER BY menu_order;"
```

### 3.3 Dodeli permisije SUPER_ADMIN roli
```bash
docker exec smartcity-mysql-local mysql -u smartcity_user -pSecurePassword123! smartcity_dev -e "INSERT INTO role_permissions (roleId, permissionId) SELECT 1, id FROM permissions WHERE resource LIKE 'transport.administration%';"
```

### 3.4 Proveri dodeljene permisije
```bash
docker exec smartcity-mysql-local mysql -u smartcity_user -pSecurePassword123! smartcity_dev -e "SELECT r.name as role_name, p.name as permission_name, p.description_sr FROM role_permissions rp JOIN roles r ON rp.roleId = r.id JOIN permissions p ON rp.permissionId = p.id WHERE p.resource LIKE 'transport.administration%' ORDER BY p.menu_order;"
```

---

## KORAK 4: Dodavanje opcije u meni (ModernMenu.tsx)

**Fajl:** `/apps/admin-portal/src/components/layout/ModernMenu.tsx`

### 4.1 Dodaj novu grupu u menuItems array

Pronađi odgovarajuću poziciju u `children` array-u (npr. između Vozila i Dispečerskog):

```typescript
children: [
  {
    key: 'vehicles',
    menuOrder: 301000000000,
    icon: <CarOutlined />,
    label: 'Vozila',
    children: [
      // ... postojeće opcije
    ],
  },
  // 🆕 NOVA GRUPA - Dodaj ovde!
  {
    key: 'administration',
    menuOrder: 301500000000,
    icon: <SettingOutlined />,
    label: 'Administracija',
    children: [
      {
        key: '/transport/administration/central-points',
        menuOrder: 301510000000,
        icon: <EnvironmentOutlined />,
        label: 'Centralne tačke',
        permissions: ['transport.administration.central_points:view'],
      },
    ],
  },
  {
    key: 'dispatcher',
    menuOrder: 302000000000,
    icon: <RadarChartOutlined />,
    label: 'Dispečerski Modul',
    // ... ostale opcije
  },
],
```

### 4.2 Dodaj auto-expand logiku

U `useEffect` hook-u za auto-otvaranje menija:

```typescript
useEffect(() => {
  const path = location.pathname;
  const keys: string[] = [];

  if (path.includes('/transport/')) {
    keys.push('transport');
    if (path.includes('/vehicle')) keys.push('vehicles');
    if (path.includes('/administration/')) keys.push('administration'); // 🆕 DODAJ OVO!
    if (path.includes('/dispatcher/')) keys.push('dispatcher');
    if (path.includes('/safety/')) keys.push('safety');
    if (path.includes('/maintenance/')) keys.push('maintenance');
  }

  setOpenKeys(keys);
}, [location.pathname]);
```

---

## KORAK 5: Ažuriranje PermissionsTree mapiranja

**Fajl:** `/apps/admin-portal/src/pages/users/components/PermissionsTree.tsx`

### 5.1 Dodaj menuOrder mapiranje u getMenuName() funkciju

Pronađi `getMenuName()` funkciju i dodaj nove menuOrder brojeve:

```typescript
const getMenuName = (menuOrder: number): string => {
  // ... postojeći kod ...

  // Drugi nivo - Transport
  if (menuOrder === 301000000000) return 'Vozila';
  if (menuOrder === 301500000000) return 'Administracija'; // 🆕 DODAJ OVO!
  if (menuOrder === 302000000000) return 'Dispečerski Modul';
  if (menuOrder === 303000000000) return 'Bezbednost i Analiza';
  if (menuOrder === 304000000000) return 'Održavanje Sistema';

  // ... postojeći kod ...

  // Treći nivo - Administracija
  if (menuOrder === 301510000000) return 'Centralne tačke'; // 🆕 DODAJ OVO!

  // ... ostali nivoi
}
```

**⚠️ VAŽNO:** Proveri da li postoje i drugi menuOrder brojevi koje treba ažurirati!

---

## KORAK 6: Kreiranje stranice i dodavanje rute

### 6.1 Kreiraj folder za stranicu
```bash
mkdir -p /home/kocev/smart-city/apps/admin-portal/src/pages/transport/administration
```

### 6.2 Kreiraj React komponentu

**Fajl:** `/apps/admin-portal/src/pages/transport/administration/CentralPoints.tsx`

```typescript
import React from 'react';
import { Card, Typography } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';

const { Title } = Typography;

const CentralPoints: React.FC = () => {
  return (
    <div className="p-6">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <EnvironmentOutlined className="text-2xl text-blue-500" />
          <Title level={2} className="mb-0">Centralne tačke</Title>
        </div>

        <div className="text-gray-600">
          <p>Stranica za upravljanje centralnim tačkama</p>
        </div>
      </Card>
    </div>
  );
};

export default CentralPoints;
```

### 6.3 Dodaj rutu u App.tsx

**Fajl:** `/apps/admin-portal/src/App.tsx`

#### Import komponente:
```typescript
import CentralPoints from './pages/transport/administration/CentralPoints';
```

#### Dodaj rutu:
```typescript
<Route
  path="transport/administration/central-points"
  element={
    <PermissionGuard permissions={['transport.administration.central_points:view']}>
      <CentralPoints />
    </PermissionGuard>
  }
/>
```

---

## ✅ TESTIRANJE I VERIFIKACIJA

### 1. Build test
```bash
cd /home/kocev/smart-city/apps/admin-portal
npm run build
```

### 2. Proveri da li meni prikazuje novu opciju
- Pokreni aplikaciju: `npm run dev:admin`
- Uloguj se sa SUPER_ADMIN nalogom
- Proveri da li se vidi: **Autobuski Prevoznici → Administracija → Centralne tačke**

### 3. Proveri PermissionsTree
- Idi na **Korisnici → Role i Permisije**
- Otvori bilo koju rolu
- Proveri da li se vidi sekcija **"Administracija"** sa permisijama

### 4. Test permisija
```bash
# Proveri koje role imaju pristup
docker exec smartcity-mysql-local mysql -u smartcity_user -pSecurePassword123! smartcity_dev -e "SELECT r.name, COUNT(p.id) as permissions_count FROM role_permissions rp JOIN roles r ON rp.roleId = r.id JOIN permissions p ON rp.permissionId = p.id WHERE p.resource LIKE 'transport.administration%' GROUP BY r.name;"
```

---

## 📚 DODATNE INFORMACIJE

### Struktura menuOrder brojeva

**Zapamti:**
- Uvek koristi "između" brojeve - ne pomeraj postojeće!
- String slicing logika omogućava precizno grupisanje
- Svaki par cifara je jedinstveni nivo hijerarhije

### Česte greške koje treba izbegavati

1. **❌ Pomeranje postojećih menuOrder brojeva**
   - Može pokvariti postojeći PermissionsTree

2. **❌ Korišćenje tačke (.) umesto dvotačke (:) pre akcije**
   - `transport.administration.view` ❌
   - `transport.administration:view` ✅

3. **❌ camelCase kolone u SQL-u**
   - `menuOrder` ❌
   - `menu_order` ✅

4. **❌ Zaboravljanje ažuriranja getMenuName() funkcije**
   - PermissionsTree neće prikazati pravilno novu grupu

5. **❌ Zaboravljanje auto-expand logike**
   - Meni se neće automatski otvoriti kada je opcija aktivna

### Quick Reference - Fajlovi koje treba ažurirati

1. **Backend - Prisma migracija**
   - `/apps/backend/prisma/migrations/[timestamp]_[name]/migration.sql`

2. **Frontend - Meni**
   - `/apps/admin-portal/src/components/layout/ModernMenu.tsx`

3. **Frontend - Permissions Tree**
   - `/apps/admin-portal/src/pages/users/components/PermissionsTree.tsx`

4. **Frontend - Stranica**
   - `/apps/admin-portal/src/pages/[path]/[ComponentName].tsx`

5. **Frontend - Rute**
   - `/apps/admin-portal/src/App.tsx`

### Krajnji checklist ✅

- [ ] MenuOrder brojevi određeni (IZMEĐU postojećih!)
- [ ] Prisma migracija kreirana sa snake_case kolonama
- [ ] Migracija primenjena (`prisma migrate deploy`)
- [ ] Permisije dodeljene SUPER_ADMIN roli
- [ ] ModernMenu.tsx ažuriran sa novom grupom
- [ ] Auto-expand logika dodata
- [ ] PermissionsTree getMenuName() ažuriran
- [ ] React komponenta stranice kreirana
- [ ] App.tsx ruta dodata sa PermissionGuard
- [ ] Build test prošao (`npm run build`)
- [ ] Aplikacija testirana - meni opcija vidljiva
- [ ] PermissionsTree prikazuje permisije ispravno

---

## 🎉 Gotovo!

Sada imaš potpuno funkcionalnu novu meni opciju sa permisijama, rutom i stranicom!

**Sledeći koraci:**
- Implementiraj funkcionalnost na stranici (tabele, forme, itd.)
- Dodaj backend endpoint-e ako je potrebno
- Kreiraj dodatne CRUD operacije
