-- AddSeparateGpsSyncPermissions
-- Kreiranje odvojenih permisija za GPS Real-Time Sync i Dispatcher GPS Sync

-- Dodaj novu permisiju za GPS Buffer/Real-Time Sync
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at) VALUES
  ('gps.buffer.sync:view', 'gps.buffer.sync', 'view', 'View GPS Buffer/Real-Time Sync', 'Pregled GPS Buffer/Real-time sinhronizacije', 'GPS', NOW(), NOW());

-- dispatcher.sync:view već postoji i koristiće se za Dispečerski modul GPS Sync tab

-- Napomena: Potrebno ažurirati ModernMenu.tsx da koristi 'gps.buffer.sync:view' za GPS Real-Time Sync opciju