-- OrganizeDashboardPermissions: Assign menuOrder to Dashboard related permissions

-- Dashboard Configuration
UPDATE permissions
SET menu_order = 101000000000
WHERE name = 'dashboard:update';

-- Dashboard Widgets
UPDATE permissions
SET menu_order = 102000000000
WHERE name = 'dashboard.widgets.vehicles:view';

UPDATE permissions
SET menu_order = 103000000000
WHERE name = 'dashboard.widgets.users:view';

UPDATE permissions
SET menu_order = 104000000000
WHERE name = 'dashboard.widgets.gps:view';

UPDATE permissions
SET menu_order = 105000000000
WHERE name = 'dashboard.widgets.system:view';