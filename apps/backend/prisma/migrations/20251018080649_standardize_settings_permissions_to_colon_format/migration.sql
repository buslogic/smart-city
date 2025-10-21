-- Standardizacija Settings permisija na : format i dodavanje menuOrder vrednosti
-- Cilj: Backend koristi : format, struktura prati glavni meni 1:1

-- ============================================================================
-- 1. PREIMENUJ legacy_databases permisije sa . na : format
-- ============================================================================

UPDATE permissions
SET
  name = 'legacy_databases:read',
  category = 'Settings',
  updated_at = NOW()
WHERE name = 'legacy_databases.read' AND resource = 'legacy_databases' AND action = 'read';

UPDATE permissions
SET
  name = 'legacy_databases:create',
  category = 'Settings',
  updated_at = NOW()
WHERE name = 'legacy_databases.create' AND resource = 'legacy_databases' AND action = 'create';

UPDATE permissions
SET
  name = 'legacy_databases:update',
  category = 'Settings',
  updated_at = NOW()
WHERE name = 'legacy_databases.update' AND resource = 'legacy_databases' AND action = 'update';

UPDATE permissions
SET
  name = 'legacy_databases:delete',
  category = 'Settings',
  updated_at = NOW()
WHERE name = 'legacy_databases.delete' AND resource = 'legacy_databases' AND action = 'delete';

-- ============================================================================
-- 2. PREIMENUJ legacy_tables permisije sa . na : format
-- ============================================================================

UPDATE permissions
SET
  name = 'legacy_tables:read',
  category = 'Settings',
  updated_at = NOW()
WHERE name = 'legacy_tables.read' AND resource = 'legacy_tables' AND action = 'read';

UPDATE permissions
SET
  name = 'legacy_tables:create',
  category = 'Settings',
  updated_at = NOW()
WHERE name = 'legacy_tables.create' AND resource = 'legacy_tables' AND action = 'create';

UPDATE permissions
SET
  name = 'legacy_tables:update',
  category = 'Settings',
  updated_at = NOW()
WHERE name = 'legacy_tables.update' AND resource = 'legacy_tables' AND action = 'update';

UPDATE permissions
SET
  name = 'legacy_tables:delete',
  category = 'Settings',
  updated_at = NOW()
WHERE name = 'legacy_tables.delete' AND resource = 'legacy_tables' AND action = 'delete';

-- ============================================================================
-- 3. DODAJ/AŽURIRAJ menuOrder za SVE settings permisije
-- ============================================================================

-- Hijerarhija:
-- Podešavanje (400000000000) - nema permisiju u bazi
-- ├── Opšta (401000000000) - nema permisiju u bazi
-- │   ├── Informacije o Kompaniji (401010000000)
-- │   │   ├── settings.company_info:read (401010000001)
-- │   │   └── settings.company_info:write (401010000002)
-- │   ├── Legacy Baze (401020000000)
-- │   │   ├── legacy_databases:read (401020000001)
-- │   │   ├── legacy_databases:create (401020000002)
-- │   │   ├── legacy_databases:update (401020000003)
-- │   │   └── legacy_databases:delete (401020000004)
-- │   ├── Legacy Tabele (401030000000)
-- │   │   ├── legacy_tables:read (401030000001)
-- │   │   ├── legacy_tables:create (401030000002)
-- │   │   ├── legacy_tables:update (401030000003)
-- │   │   └── legacy_tables:delete (401030000004)
-- │   └── Email Šabloni (401040000000)
-- │       ├── settings.email_templates:view (401040000001)
-- │       ├── settings.email_templates:create (401040000002)
-- │       ├── settings.email_templates:update (401040000003)
-- │       ├── settings.email_templates:delete (401040000004)
-- │       └── settings.email_templates:test (401040000005)
-- └── API Keys (402000000000)
--     └── api_keys:view (već ima menuOrder)

-- Company Info permissions
UPDATE permissions
SET menu_order = 401010000001, category = 'Settings', updated_at = NOW()
WHERE name = 'settings.company_info:read';

UPDATE permissions
SET menu_order = 401010000002, category = 'Settings', updated_at = NOW()
WHERE name = 'settings.company_info:write';

-- Legacy Databases permissions (nakon rename-a)
UPDATE permissions
SET menu_order = 401020000001, category = 'Settings', updated_at = NOW()
WHERE name = 'legacy_databases:read';

UPDATE permissions
SET menu_order = 401020000002, category = 'Settings', updated_at = NOW()
WHERE name = 'legacy_databases:create';

UPDATE permissions
SET menu_order = 401020000003, category = 'Settings', updated_at = NOW()
WHERE name = 'legacy_databases:update';

UPDATE permissions
SET menu_order = 401020000004, category = 'Settings', updated_at = NOW()
WHERE name = 'legacy_databases:delete';

-- Legacy Tables permissions (nakon rename-a)
UPDATE permissions
SET menu_order = 401030000001, category = 'Settings', updated_at = NOW()
WHERE name = 'legacy_tables:read';

UPDATE permissions
SET menu_order = 401030000002, category = 'Settings', updated_at = NOW()
WHERE name = 'legacy_tables:create';

UPDATE permissions
SET menu_order = 401030000003, category = 'Settings', updated_at = NOW()
WHERE name = 'legacy_tables:update';

UPDATE permissions
SET menu_order = 401030000004, category = 'Settings', updated_at = NOW()
WHERE name = 'legacy_tables:delete';

-- Email Templates permissions
UPDATE permissions
SET menu_order = 401040000001, category = 'Settings', updated_at = NOW()
WHERE name = 'settings.email_templates:view';

UPDATE permissions
SET menu_order = 401040000002, category = 'Settings', updated_at = NOW()
WHERE name = 'settings.email_templates:create';

UPDATE permissions
SET menu_order = 401040000003, category = 'Settings', updated_at = NOW()
WHERE name = 'settings.email_templates:update';

UPDATE permissions
SET menu_order = 401040000004, category = 'Settings', updated_at = NOW()
WHERE name = 'settings.email_templates:delete';

UPDATE permissions
SET menu_order = 401040000005, category = 'Settings', updated_at = NOW()
WHERE name = 'settings.email_templates:test';

-- ============================================================================
-- 4. VERIFIKACIJA - Proveri da li su sve settings permisije ažurirane
-- ============================================================================

-- Ova SELECT komanda će prikazati rezultate nakon migracije (za debug)
-- SELECT name, resource, action, category, menu_order
-- FROM permissions
-- WHERE category = 'Settings' OR resource LIKE 'settings%' OR resource LIKE 'legacy_%'
-- ORDER BY menu_order, resource, action;
