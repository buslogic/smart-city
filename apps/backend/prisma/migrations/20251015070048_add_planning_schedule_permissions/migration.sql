-- CreateEnum
-- Dodavanje planning permisija

INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, menu_order, created_at, updated_at)
VALUES
  ('transport.planning.schedule:view', 'transport.planning.schedule', 'view',
   'View daily schedule', 'Pregled dnevnog rasporeda', 'Transport - Planning', 302050010001, NOW(), NOW()),
  ('transport.planning.schedule.create', 'transport.planning.schedule', 'create',
   'Create daily schedule', 'Kreiranje dnevnog rasporeda', 'Transport - Planning', 302050010002, NOW(), NOW());
