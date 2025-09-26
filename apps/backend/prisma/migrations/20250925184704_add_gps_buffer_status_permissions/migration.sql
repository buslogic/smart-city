-- CreateEnum
-- CreateTable
-- CreateIndex
-- AddForeignKey

-- Add GPS Buffer Status permissions and menu_order values for PermissionsTree visibility
-- Ove permisije spadaju pod "Dispečerski" (302000000000) → GPS Buffer Status sekcija

-- Kreiraj nedostajuće permisije za GPS Buffer Status dashboard
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at, menu_order)
VALUES
  -- Glavna permisija za pristup GPS Buffer Status stranici (koristi se u App.tsx)
  ('dispatcher:sync_gps', 'dispatcher', 'sync_gps', 'Access GPS Buffer Status Dashboard', 'Pristup GPS Buffer Status Dashboard-u', 'Dispečerski', NOW(), NOW(), 302040000000),

  -- Permisija za pregled buffer status podataka (koristi se u svim GET endpoint-ima backend kontrolera)
  ('dispatcher:view_sync_dashboard', 'dispatcher', 'view_sync_dashboard', 'View GPS sync dashboard data', 'Pregled GPS sinhronizacionog dashboard-a', 'Dispečerski', NOW(), NOW(), 302040000001);

-- Ažuriraj postojeće permisije sa menu_order vrednostima za hijerarhijski prikaz
UPDATE permissions
SET menu_order = 302040000002
WHERE name = 'dispatcher.manage_cron';

UPDATE permissions
SET menu_order = 302040000003
WHERE name = 'dispatcher.manage_gps';