-- Fix menuOrder for Settings > General folder structure
-- Ensure proper 4-level hierarchy where groups don't have permissions in DB

-- Update legacy_databases:read from 401020000000 to 401020000001
UPDATE permissions
SET menu_order = 401020000001, updated_at = NOW()
WHERE name = 'legacy_databases:read' AND menu_order = 401020000000;

-- Update legacy_databases:write from 401020000001 to 401020000002
UPDATE permissions
SET menu_order = 401020000002, updated_at = NOW()
WHERE name = 'legacy_databases:write' AND menu_order = 401020000001;

-- Update legacy_tables:read from 401030000000 to 401030000001
UPDATE permissions
SET menu_order = 401030000001, updated_at = NOW()
WHERE name = 'legacy_tables:read' AND menu_order = 401030000000;

-- Update legacy_tables:write from 401030000001 to 401030000002
UPDATE permissions
SET menu_order = 401030000002, updated_at = NOW()
WHERE name = 'legacy_tables:write' AND menu_order = 401030000001;

-- Note: Folder/group entries (401010000000, 401020000000, 401030000000, 401040000000)
-- do NOT have permissions in the database - they are organizational units in the menu only
