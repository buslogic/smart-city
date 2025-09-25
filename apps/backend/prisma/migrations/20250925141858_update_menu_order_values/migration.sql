-- UpdateMenuOrderValues
-- Ažuriranje menu_order vrednosti za permisije na osnovu hijerarhije iz ModernMenu.tsx

-- Prvi nivo - glavne sekcije (12-cifarna struktura počevši od 10)
UPDATE permissions SET menu_order = 100000000000 WHERE name = 'dashboard:view';
UPDATE permissions SET menu_order = 200000000000 WHERE name = 'users:view';
UPDATE permissions SET menu_order = 300000000000 WHERE name = 'transport:view';
UPDATE permissions SET menu_order = 400000000000 WHERE name = 'settings:view';

-- Drugi nivo - pod-sekcije
UPDATE permissions SET menu_order = 202000000000 WHERE name = 'roles:view';
UPDATE permissions SET menu_order = 301000000000 WHERE name = 'vehicles:view';
UPDATE permissions SET menu_order = 302000000000 WHERE name = 'dispatcher:view';
UPDATE permissions SET menu_order = 303000000000 WHERE name = 'safety:view';
UPDATE permissions SET menu_order = 304000000000 WHERE name = 'maintenance:view';

-- Treći nivo - specifične funkcionalnosti
-- Vozila sekcija (301)
UPDATE permissions SET menu_order = 301010000000 WHERE name = 'vehicles:read';
UPDATE permissions SET menu_order = 301020000000 WHERE name = 'vehicles.sync:view';
UPDATE permissions SET menu_order = 301030000000 WHERE name = 'gps.buffer.sync:view';  -- GPS Real-Time Sync
UPDATE permissions SET menu_order = 301040000000 WHERE name = 'legacy.sync:view';
UPDATE permissions SET menu_order = 301050000000 WHERE name = 'system:manage';

-- Dispečerski modul (302)
UPDATE permissions SET menu_order = 302010000000 WHERE name = 'dispatcher:view_map';
UPDATE permissions SET menu_order = 302020000000 WHERE name = 'dispatcher:view_analytics';
UPDATE permissions SET menu_order = 302030000000 WHERE name = 'dispatcher.sync:view';  -- GPS Sync tab

-- Bezbednost sekcija (303)
UPDATE permissions SET menu_order = 303010000000 WHERE name = 'safety.aggressive.driving:view';
UPDATE permissions SET menu_order = 303020000000 WHERE name = 'safety.reports:view';
UPDATE permissions SET menu_order = 303030000000 WHERE name = 'safety.data.recreation:view';

-- Održavanje sekcija (304)
UPDATE permissions SET menu_order = 304010000000 WHERE name = 'maintenance.timescaledb:view';

-- Podešavanje sekcija (401, 402)
UPDATE permissions SET menu_order = 401000000000 WHERE name = 'settings.general:view';
UPDATE permissions SET menu_order = 402000000000 WHERE name = 'api_keys:view';