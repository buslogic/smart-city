-- CreateEnum
-- CreateTable
-- CreateIndex
-- AddForeignKey

-- Fix GPS Buffer Status permissions hierarchy - move from Dispečerski to Autobuski Prevoznici → Vozila → GPS Real-Time Sync
-- ISPRAVKA: GPS Buffer Status treba da bude pod GPS Real-Time Sync (301020000000) a ne pod Dispečerski

-- Prebaci GPS Buffer Status permisije iz Dispečerski (302040xxx) u Vozila → GPS Real-Time Sync (301020001xxx)
UPDATE permissions
SET
  menu_order = 301020001000,
  category = 'Vozila'
WHERE name = 'dispatcher:sync_gps';

UPDATE permissions
SET
  menu_order = 301020001001,
  category = 'Vozila'
WHERE name = 'dispatcher:view_sync_dashboard';

UPDATE permissions
SET
  menu_order = 301020001002,
  category = 'Vozila'
WHERE name = 'dispatcher.manage_cron';

UPDATE permissions
SET
  menu_order = 301020001003,
  category = 'Vozila'
WHERE name = 'dispatcher.manage_gps';