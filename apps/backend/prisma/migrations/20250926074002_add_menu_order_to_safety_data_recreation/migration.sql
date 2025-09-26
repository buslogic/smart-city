-- Add menu_order to safety.data.recreation CRUD permissions
-- This moves them from "Ostale Permisije" to proper hierarchy under Transport > Safety > Data Recreation

-- Safety Data Recreation permissions - under Transport > Safety > Data Recreation (303030000000)
UPDATE permissions SET menu_order = 303030000001 WHERE name = 'safety.data.recreation:configure';
UPDATE permissions SET menu_order = 303030000002 WHERE name = 'safety.data.recreation:start';
UPDATE permissions SET menu_order = 303030000003 WHERE name = 'safety.data.recreation:stop';