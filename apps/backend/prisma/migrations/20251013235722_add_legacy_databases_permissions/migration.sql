-- CreateEnum
-- Dodaj permisije za Legacy Databases modul

INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at)
VALUES
  ('legacy_databases.read', 'legacy_databases', 'read', 'View Legacy Databases', 'Pregled Legacy baza podataka', 'Legacy Databases', NOW(), NOW()),
  ('legacy_databases.create', 'legacy_databases', 'create', 'Create Legacy Database', 'Kreiranje Legacy baze podataka', 'Legacy Databases', NOW(), NOW()),
  ('legacy_databases.update', 'legacy_databases', 'update', 'Update Legacy Database', 'Ažuriranje Legacy baze podataka', 'Legacy Databases', NOW(), NOW()),
  ('legacy_databases.delete', 'legacy_databases', 'delete', 'Delete Legacy Database', 'Brisanje Legacy baze podataka', 'Legacy Databases', NOW(), NOW());
