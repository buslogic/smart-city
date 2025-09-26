-- CreateEnum
-- CreateTable
-- CreateIndex
-- AddForeignKey

-- Add menu_order values to legacy sync operacije for PermissionsTree visibility
-- Ove permisije spadaju pod "Legacy Sync" (301040000000)

-- Ažuriraj postojeće permisije sa menu_order vrednostima
UPDATE permissions
SET menu_order = 301040000001
WHERE name = 'legacy.sync:start';

UPDATE permissions
SET menu_order = 301040000002
WHERE name = 'legacy.sync:stop';

UPDATE permissions
SET menu_order = 301040000003
WHERE name = 'legacy.sync:configure';