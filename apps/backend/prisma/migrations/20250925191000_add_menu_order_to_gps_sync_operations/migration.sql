-- CreateEnum
-- CreateTable
-- CreateIndex
-- AddForeignKey

-- Add menu_order values to GPS Sync operacije for PermissionsTree visibility
-- Ove permisije spadaju pod "GPS Sync" (302030000000)

-- Ažuriraj postojeće GPS Sync permisije sa menu_order vrednostima
UPDATE permissions
SET menu_order = 302030000001
WHERE name = 'dispatcher.sync:start';

UPDATE permissions
SET menu_order = 302030000002
WHERE name = 'dispatcher.sync:stop';

UPDATE permissions
SET menu_order = 302030000003
WHERE name = 'dispatcher.sync:cleanup';

UPDATE permissions
SET menu_order = 302030000004
WHERE name = 'dispatcher.sync:configure';