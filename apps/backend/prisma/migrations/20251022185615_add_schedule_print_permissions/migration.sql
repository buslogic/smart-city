-- Add Schedule Print permissions (between Schedule and Turnus Defaults)
-- MenuOrder: 302050015000 (between 302050010000 and 302050020000)

-- 1. Štampa Rasporeda - VIEW permisija (pristup stranici)
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.schedule_print:view',
  'transport.planning.schedule_print',
  'view',
  'View schedule printing',
  'Pregled štampe rasporeda',
  'transport',
  302050015000,
  NOW()
);

-- 2. Štampa Rasporeda - EXPORT permisija (export/print akcija)
INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.planning.schedule_print:export',
  'transport.planning.schedule_print',
  'export',
  'Export/print schedule',
  'Štampa i izvoz rasporeda',
  'transport',
  302050015001,
  NOW()
);
