-- Fix menuOrder for Schedule Print permissions + complete reorganization
-- First INSERT Schedule Print and Linked Turnusi if they don't exist
-- Then reorganize all menuOrders
-- Final hierarchy: Schedule (01) -> Schedule Print (02) -> Turnus Defaults (03) -> Linked Turnusi (04)

-- Step 1: Insert Schedule Print permissions if they don't exist
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES
  ('transport.planning.schedule_print:view', 'transport.planning.schedule_print', 'view', 'View schedule printing', 'Pregled štampe rasporeda', 'transport', 302050015000, NOW()),
  ('transport.planning.schedule_print:export', 'transport.planning.schedule_print', 'export', 'Export/print schedule', 'Štampa i izvoz rasporeda', 'transport', 302050015001, NOW());

-- Step 2: Insert Linked Turnusi permissions if they don't exist
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES
  ('transport.planning.linked_turnusi:view', 'transport.planning.linked_turnusi', 'view', 'View linked turnusi', 'Pregled povezanih turnusa', 'transport', 302050030000, NOW()),
  ('transport.planning.linked_turnusi:create', 'transport.planning.linked_turnusi', 'create', 'Create linked turnusi', 'Kreiranje povezanih turnusa', 'transport', 302050030001, NOW()),
  ('transport.planning.linked_turnusi:update', 'transport.planning.linked_turnusi', 'update', 'Update linked turnusi', 'Izmena povezanih turnusa', 'transport', 302050030002, NOW()),
  ('transport.planning.linked_turnusi:delete', 'transport.planning.linked_turnusi', 'delete', 'Delete linked turnusi', 'Brisanje povezanih turnusa', 'transport', 302050030003, NOW());

-- Step 3: Now reorganize menuOrders - move Linked Turnusi to temporary high numbers to avoid conflicts
UPDATE permissions SET menu_order = 302050090000 WHERE menu_order = 302050030000;
UPDATE permissions SET menu_order = 302050090001 WHERE menu_order = 302050030001;
UPDATE permissions SET menu_order = 302050090002 WHERE menu_order = 302050030002;
UPDATE permissions SET menu_order = 302050090003 WHERE menu_order = 302050030003;

-- Move Turnus Defaults to temporary numbers
UPDATE permissions SET menu_order = 302050080000 WHERE menu_order = 302050020000;
UPDATE permissions SET menu_order = 302050080001 WHERE menu_order = 302050020001;
UPDATE permissions SET menu_order = 302050080002 WHERE menu_order = 302050020002;
UPDATE permissions SET menu_order = 302050080003 WHERE menu_order = 302050020003;
UPDATE permissions SET menu_order = 302050080004 WHERE menu_order = 302050020004;
UPDATE permissions SET menu_order = 302050080005 WHERE menu_order = 302050020005;

-- Move Schedule Print to 020000 range
UPDATE permissions SET menu_order = 302050020000 WHERE menu_order = 302050015000;
UPDATE permissions SET menu_order = 302050020001 WHERE menu_order = 302050015001;

-- Move Turnus Defaults to 030000 range
UPDATE permissions SET menu_order = 302050030000 WHERE menu_order = 302050080000;
UPDATE permissions SET menu_order = 302050030001 WHERE menu_order = 302050080001;
UPDATE permissions SET menu_order = 302050030002 WHERE menu_order = 302050080002;
UPDATE permissions SET menu_order = 302050030003 WHERE menu_order = 302050080003;
UPDATE permissions SET menu_order = 302050030004 WHERE menu_order = 302050080004;
UPDATE permissions SET menu_order = 302050030005 WHERE menu_order = 302050080005;

-- Move Linked Turnusi to 040000 range
UPDATE permissions SET menu_order = 302050040000 WHERE menu_order = 302050090000;
UPDATE permissions SET menu_order = 302050040001 WHERE menu_order = 302050090001;
UPDATE permissions SET menu_order = 302050040002 WHERE menu_order = 302050090002;
UPDATE permissions SET menu_order = 302050040003 WHERE menu_order = 302050090003;
