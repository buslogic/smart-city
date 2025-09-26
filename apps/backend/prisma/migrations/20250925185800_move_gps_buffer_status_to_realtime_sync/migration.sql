-- CreateEnum
-- CreateTable
-- CreateIndex
-- AddForeignKey

-- Move GPS Buffer Status from Sinhronizacija (301020xxx) to GPS Real-Time Sync (301030xxx)
-- ISPRAVKA: GPS Buffer Status treba da bude pod GPS Real-Time Sync a ne pod Sinhronizacija

-- Prebaci GPS Buffer Status permisije iz 301020001xxx u 301030001xxx opseg
UPDATE permissions SET menu_order = 301030001000 WHERE name = 'gps.buffer.status:view';
UPDATE permissions SET menu_order = 301030001001 WHERE name = 'dispatcher:sync_gps';
UPDATE permissions SET menu_order = 301030001002 WHERE name = 'dispatcher:view_sync_dashboard';
UPDATE permissions SET menu_order = 301030001003 WHERE name = 'dispatcher.manage_cron';
UPDATE permissions SET menu_order = 301030001004 WHERE name = 'dispatcher.manage_gps';