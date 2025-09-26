-- CreateEnum
-- CreateTable
-- CreateIndex
-- AddForeignKey

-- Add system:view permission for GPS Migration main menu and reorganize hierarchy
-- Potrebno je da se kreiraj glavna 'view' permisija da bi PermissionsTree prepoznao sekciju

-- Pomeriti postojeću system:manage permisiju za +1 da ostavimo mesto za glavnu view permisiju
UPDATE permissions SET menu_order = 301050000001 WHERE name = 'system:manage';

-- Kreiraj glavnu view permisiju za GPS Migration sekciju
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at, menu_order)
VALUES
  ('system:view', 'system', 'view', 'View GPS Migration', 'Pregled GPS migracije', 'Vozila', NOW(), NOW(), 301050000000);