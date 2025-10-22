-- Fix menuOrder for Linked Turnusi permissions
-- First INSERT if not exists, then UPDATE menuOrder
-- Change from 302050025000 to 302050030000 to avoid 5-level hierarchy parsing issue
-- Correct format: 30 20 50 03 00 00 (4 levels, not 5)

-- 1. Insert Linked Turnusi permissions if they don't exist (with WRONG menuOrder initially)
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES
  ('transport.planning.linked_turnusi:view', 'transport.planning.linked_turnusi', 'view', 'View linked turnusi', 'Pregled povezanih turnusa', 'transport', 302050025000, NOW()),
  ('transport.planning.linked_turnusi:create', 'transport.planning.linked_turnusi', 'create', 'Create linked turnusi', 'Kreiranje povezanih turnusa', 'transport', 302050025001, NOW()),
  ('transport.planning.linked_turnusi:update', 'transport.planning.linked_turnusi', 'update', 'Update linked turnusi', 'Izmena povezanih turnusa', 'transport', 302050025002, NOW()),
  ('transport.planning.linked_turnusi:delete', 'transport.planning.linked_turnusi', 'delete', 'Delete linked turnusi', 'Brisanje povezanih turnusa', 'transport', 302050025003, NOW());

-- 2. Now fix the menuOrder to correct values
UPDATE permissions SET menu_order = 302050030000, updated_at = NOW() WHERE name = 'transport.planning.linked_turnusi:view';
UPDATE permissions SET menu_order = 302050030001, updated_at = NOW() WHERE name = 'transport.planning.linked_turnusi:create';
UPDATE permissions SET menu_order = 302050030002, updated_at = NOW() WHERE name = 'transport.planning.linked_turnusi:update';
UPDATE permissions SET menu_order = 302050030003, updated_at = NOW() WHERE name = 'transport.planning.linked_turnusi:delete';
