-- Add menu_order to maintenance.timescaledb:manage permission
-- This moves it from "Ostale Permisije" to proper hierarchy under Transport > Maintenance > TimescaleDB

-- TimescaleDB maintenance permission - under Transport > Maintenance > TimescaleDB (304010000000)
UPDATE permissions SET menu_order = 304010000001 WHERE name = 'maintenance.timescaledb:manage';