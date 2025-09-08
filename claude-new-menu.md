# Vodič za dodavanje nove opcije menija u Smart City Admin Portal

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

## KORAK 1: Dodavanje opcije u meni i kreiranje stranice

**Cilj:** Dodati novu opciju/grupu u postojeći meni i kreirati osnovnu stranicu

**Vreme potrebno:** 5-10 minuta

### ⚠️ PRE POČETKA: Permisije MORAJU koristiti DVOTAČKU (:) pre akcije
Primer: `maintenance.timescaledb:view` ✅ NE `maintenance.timescaledb.view` ❌

### 1.1 **Dodavanje opcije u meni komponentu**
Fajl: `/apps/admin-portal/src/components/layout/ModernMenuV1.tsx`

#### Za grupu (folder) sa pod-opcijama:
```typescript
{
  name: 'Alati za održavanje',
  icon: Settings,  // Ikona iz lucide-react
  hasSubmenu: true,
  isOpen: expandedSections.has('Alati za održavanje'),
  setOpen: () => toggleSection('Alati za održavanje'),
  submenu: [
    {
      name: 'TimescaleDB',
      href: '/transport/maintenance/timescaledb',  // Putanja
      icon: Database,
      permissions: ['maintenance.timescaledb:view'],  // Permisija sa DVOTAČKOM pre akcije
    },
  ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p))),
},
```

#### Lokacija u hijerarhiji:
- Grupa se dodaje u `submenu` array postojeće grupe
- U našem slučaju: `Autobuski Prevoznici` → `submenu` → nova grupa `Alati za održavanje`

### 1.2 **Auto-expand sekcija**
U istom fajlu, dodaj logiku za auto-otvaranje menija kada je opcija aktivna:

```typescript
useEffect(() => {
  const path = location.pathname;
  // ... postojeći kod ...
  if (path.includes('/maintenance/')) {
    expandedSections.add('Autobuski Prevoznici');  // Parent grupa
    expandedSections.add('Alati za održavanje');     // Nova grupa
  }
  setExpandedSections(new Set(expandedSections));
}, [location.pathname]);
```

### 1.3 **Kreiranje stranice komponente**
Fajl: `/apps/admin-portal/src/pages/transport/maintenance/TimescaleDB.tsx`

```typescript
import React from 'react';
import { Card, Typography } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';

const { Title } = Typography;

const TimescaleDB: React.FC = () => {
  return (
    <div className="p-6">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <DatabaseOutlined className="text-2xl text-blue-500" />
          <Title level={2} className="mb-0">TimescaleDB</Title>
        </div>
        
        <div className="text-gray-600">
          <p>TimescaleDB stranica</p>
        </div>
      </Card>
    </div>
  );
};

export default TimescaleDB;
```

### 1.4 **Dodavanje rute**
Fajl: `/apps/admin-portal/src/App.tsx`

#### Import komponente:
```typescript
import TimescaleDB from './pages/transport/maintenance/TimescaleDB';
```

#### Definisanje rute:
```typescript
<Route 
  path="transport/maintenance/timescaledb" 
  element={
    <PermissionGuard permissions={['maintenance.timescaledb.view']}>
      <TimescaleDB />
    </PermissionGuard>
  } 
/>
```

### 1.5 **Permisije**

#### Frontend permisija:
- Koristi se u `PermissionGuard` komponenti
- Format: `['maintenance.timescaledb.view']` (sa TAČKOM!)

#### Backend permisija (ako treba):
Dodaj u `/apps/backend/src/permissions/config/route-permissions.config.ts`:
```typescript
{
  route: '/transport/maintenance/timescaledb',
  requiredPermissions: ['maintenance.timescaledb.view'],
  optionalPermissions: [],
}
```

---

## KORAK 2: Kreiranje permisije u bazi podataka

**Cilj:** Kreirati permisiju u bazi i dodeliti je odgovarajućim rolama

**Vreme potrebno:** 5 minuta

### 2.1 **Struktura tabele permissions**

Tabela: `permissions`

Polja:
- `name` - jedinstveno ime (npr. `maintenance.timescaledb.view`)
- `resource` - resurs (npr. `maintenance.timescaledb`)
- `action` - akcija (npr. `view`)
- `description` - opis na engleskom
- `description_sr` - opis na srpskom
- `category` - kategorija (npr. `maintenance`)

### 2.2 **SQL za kreiranje permisije**

```sql
INSERT INTO permissions (name, resource, action, description, description_sr, category)
VALUES (
  'maintenance.timescaledb.view',
  'maintenance.timescaledb',
  'view',
  'View TimescaleDB maintenance page',
  'Pregled TimescaleDB stranice za održavanje',
  'maintenance'
);
```

### 2.3 **Dodela permisije roli**

```sql
-- Dodeli permisiju SUPER_ADMIN roli (obično ima role_id = 1)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE name = 'maintenance.timescaledb.view';

-- Ili za specifičnu rolu po nazivu
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'SUPER_ADMIN' 
AND p.name = 'maintenance.timescaledb.view';
```

### 2.4 **Provera**

```sql
-- Proveri da li je permisija kreirana
SELECT * FROM permissions WHERE name = 'maintenance.timescaledb.view';

-- Proveri koje role imaju ovu permisiju
SELECT r.name as role_name, p.name as permission_name
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
WHERE p.name = 'maintenance.timescaledb.view';
```

---

## DODATNE INFORMACIJE

### Struktura putanja

```
/transport/                         # Root za transport modul
  /vehicles                         # Vozila
  /dispatcher/                      # Dispečerski modul
    /map-vehicles
    /analytics
    /gps-sync
  /safety/                          # Bezbednost
    /aggressive-driving
    /monthly-report
  /maintenance/                     # NOVA GRUPA - Alati za održavanje
    /timescaledb                    # Nova opcija
```

### Česta greška - Ikone

Sve ikone dolaze iz `lucide-react` biblioteke. Import:
```typescript
import { Database, Settings, Tool } from 'lucide-react';
```

### Napomene

1. **Hijerarhija menija**: Maksimalno 3 nivoa (Glavna grupa → Podgrupa → Opcija)
2. **Permisije**: Svaka opcija mora imati permisiju
3. **Auto-expand**: Obavezno dodaj logiku za auto-otvaranje
4. **Putanje**: Uvek počinju sa `/` i prate hijerarhiju menija
5. **Komponente**: Kreiraj u folder strukturi koja odgovara putanji

### Primer dodavanja jednostavne opcije (bez podgrupe)

Ako treba dodati samo jednu opciju bez grupe:
```typescript
{
  name: 'Ime Opcije',
  href: '/transport/ime-opcije',
  icon: IconName,
  permissions: ['modul.resurs.akcija'],  // SA TAČKOM!
}
```