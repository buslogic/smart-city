-- Promeni format maintenance.timescaledb.view permisije sa tačke na dvotačku
UPDATE permissions 
SET name = 'maintenance.timescaledb:view'
WHERE name = 'maintenance.timescaledb.view';

-- Ažuriraj i resource da bude konzistentan
UPDATE permissions 
SET resource = 'maintenance.timescaledb'
WHERE name = 'maintenance.timescaledb:view';