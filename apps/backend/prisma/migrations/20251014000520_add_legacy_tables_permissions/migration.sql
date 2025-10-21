-- CreateEnum
-- Dodaj permisije za Legacy Table Mappings modul

INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at)
VALUES
  ('legacy_tables.read', 'legacy_tables', 'read', 'View Legacy Table Mappings', 'Pregled mapiranja legacy tabela', 'Legacy Tables', NOW(), NOW()),
  ('legacy_tables.create', 'legacy_tables', 'create', 'Create Legacy Table Mapping', 'Kreiranje mapiranja legacy tabela', 'Legacy Tables', NOW(), NOW()),
  ('legacy_tables.update', 'legacy_tables', 'update', 'Update Legacy Table Mapping', 'Ažuriranje mapiranja legacy tabela', 'Legacy Tables', NOW(), NOW()),
  ('legacy_tables.delete', 'legacy_tables', 'delete', 'Delete Legacy Table Mapping', 'Brisanje mapiranja legacy tabela', 'Legacy Tables', NOW(), NOW());
