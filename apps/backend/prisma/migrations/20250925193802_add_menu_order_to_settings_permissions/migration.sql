-- CreateEnum
-- CreateTable
-- CreateIndex
-- AddForeignKey

-- Add menu_order values for Settings permissions

-- Podešavanja (400000000000) - već ima settings:view
-- ├── Opšta (401000000000) - već ima settings.general:view
--     ├── Informacije o Kompaniji (401010000000)
--     ├── Legacy Baze (401020000000)
--     ├── Legacy Tabele (401030000000)
--     ├── Email Šabloni (401040000000)
--     └── API Podešavanja (401050000000)

-- Company Info permissions
UPDATE permissions
SET menu_order = 401010000001
WHERE name = 'settings.company_info:read';

UPDATE permissions
SET menu_order = 401010000002
WHERE name = 'settings.company_info:write';

-- Legacy Databases permissions
UPDATE permissions
SET menu_order = 401020000001
WHERE name = 'legacy_databases:read';

UPDATE permissions
SET menu_order = 401020000002
WHERE name = 'legacy_databases:create';

UPDATE permissions
SET menu_order = 401020000003
WHERE name = 'legacy_databases:update';

UPDATE permissions
SET menu_order = 401020000004
WHERE name = 'legacy_databases:delete';

UPDATE permissions
SET menu_order = 401020000005
WHERE name = 'legacy_databases:manage';

-- Legacy Tables permissions
UPDATE permissions
SET menu_order = 401030000001
WHERE name = 'legacy_tables:read';

UPDATE permissions
SET menu_order = 401030000002
WHERE name = 'legacy_tables:create';

UPDATE permissions
SET menu_order = 401030000003
WHERE name = 'legacy_tables:update';

UPDATE permissions
SET menu_order = 401030000004
WHERE name = 'legacy_tables:delete';

-- Email Templates permissions
UPDATE permissions
SET menu_order = 401040000001
WHERE name = 'settings.email_templates:view';

UPDATE permissions
SET menu_order = 401040000002
WHERE name = 'settings.email_templates:create';

UPDATE permissions
SET menu_order = 401040000003
WHERE name = 'settings.email_templates:update';

UPDATE permissions
SET menu_order = 401040000004
WHERE name = 'settings.email_templates:delete';

UPDATE permissions
SET menu_order = 401040000005
WHERE name = 'settings.email_templates:test';

-- API Settings permissions
UPDATE permissions
SET menu_order = 401050000001
WHERE name = 'settings.api.read';

UPDATE permissions
SET menu_order = 401050000002
WHERE name = 'settings.api.update';

-- General Settings additional permissions
UPDATE permissions
SET menu_order = 401000000001
WHERE name = 'settings.general.read';

UPDATE permissions
SET menu_order = 401000000002
WHERE name = 'settings.general.update';

UPDATE permissions
SET menu_order = 401000000003
WHERE name = 'settings.general:configure';

-- System Settings permissions
UPDATE permissions
SET menu_order = 401060000001
WHERE name = 'settings.system.read';

UPDATE permissions
SET menu_order = 401060000002
WHERE name = 'settings.system.update';

-- Legacy Database konfiguracija
UPDATE permissions
SET menu_order = 401020000006
WHERE name = 'settings.legacy.databases:configure';