-- AddDriverCardPermission: Add Driver Card submenu under Dispatcher module

-- Insert main permission for Driver Card
-- MenuOrder: 302040000000 (302 = Dispatcher module, 040 = fourth submenu)
INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, menu_order, ui_route, category, created_at, updated_at)
VALUES
  (
    'dispatcher.driver_card:view',
    'dispatcher.driver_card',
    'view',
    'View Driver Card',
    'Pregled Kartona Vozača',
    302040000000,
    '/transport/dispatcher/driver-card',
    'dispatcher',
    NOW(),
    NOW()
  );