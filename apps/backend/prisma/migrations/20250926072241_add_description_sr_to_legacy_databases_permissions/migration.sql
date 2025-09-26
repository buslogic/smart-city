-- Add Serbian descriptions for legacy_databases permissions
-- This improves the UX in PermissionsTree component by providing clear, distinct labels

-- Legacy Databases permissions
UPDATE permissions SET description_sr = 'Pregled legacy baza podataka'
WHERE name = 'legacy_databases:read';

UPDATE permissions SET description_sr = 'Kreiranje legacy baza podataka'
WHERE name = 'legacy_databases:create';

UPDATE permissions SET description_sr = 'Ažuriranje legacy baza podataka'
WHERE name = 'legacy_databases:update';

UPDATE permissions SET description_sr = 'Brisanje legacy baza podataka'
WHERE name = 'legacy_databases:delete';

UPDATE permissions SET description_sr = 'Upravljanje legacy bazama podataka'
WHERE name = 'legacy_databases:manage';

-- Legacy Tables permissions
UPDATE permissions SET description_sr = 'Pregled legacy tabela'
WHERE name = 'legacy_tables:read';

UPDATE permissions SET description_sr = 'Kreiranje legacy tabela'
WHERE name = 'legacy_tables:create';

UPDATE permissions SET description_sr = 'Ažuriranje legacy tabela'
WHERE name = 'legacy_tables:update';

UPDATE permissions SET description_sr = 'Brisanje legacy tabela'
WHERE name = 'legacy_tables:delete';