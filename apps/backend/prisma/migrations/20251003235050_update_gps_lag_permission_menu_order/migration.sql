-- Update menuOrder for GPS LAG Transfer permission to make it visible in PermissionsTree
UPDATE `permissions`
SET `menu_order` = 301060000000
WHERE `name` = 'vehicles.gps.lag:view';
