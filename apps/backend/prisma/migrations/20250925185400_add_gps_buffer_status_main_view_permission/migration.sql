-- CreateEnum
-- CreateTable
-- CreateIndex
-- AddForeignKey

-- Add main view permission for GPS Buffer Status and reorganize hierarchy
-- Potrebno je da se kreiraj glavna 'view' permisija da bi PermissionsTree prepoznao sekciju

-- Pomeriti postojeće GPS Buffer Status permisije za +1 da ostavimo mesto za glavnu view permisiju
UPDATE permissions SET menu_order = 301020001001 WHERE name = 'dispatcher:sync_gps';
UPDATE permissions SET menu_order = 301020001002 WHERE name = 'dispatcher:view_sync_dashboard';
UPDATE permissions SET menu_order = 301020001003 WHERE name = 'dispatcher.manage_cron';
UPDATE permissions SET menu_order = 301020001004 WHERE name = 'dispatcher.manage_gps';

-- Kreiraj glavnu view permisiju za GPS Buffer Status sekciju
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at, menu_order)
VALUES
  ('gps.buffer.status:view', 'gps.buffer.status', 'view', 'View GPS Buffer Status', 'Pregled GPS Buffer Status-a', 'Vozila', NOW(), NOW(), 301020001000);