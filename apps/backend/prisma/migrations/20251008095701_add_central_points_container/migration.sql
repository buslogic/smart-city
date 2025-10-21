-- Add third-level container permission for "Centralne tačke"

INSERT INTO permissions (name, resource, action, description, description_sr, category, menu_order, updated_at)
VALUES (
  'transport.administration.central_points:view',
  'transport.administration.central_points',
  'view',
  'Central Points - Access to submenu',
  'Centralne tačke - Pristup podmeniju',
  'transport',
  301510000000,
  NOW()
);
