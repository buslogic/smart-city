-- Fix Main Server menuOrder to match fourth-level hierarchy like Ticketing and City

-- 1. Delete old duplicate permissions (generic central_points without .main suffix)
DELETE FROM permissions WHERE name IN (
  'transport.administration.central_points:view',
  'transport.administration.central_points:create',
  'transport.administration.central_points:update',
  'transport.administration.central_points:delete'
);

-- 2. Update Main Server permissions menuOrder to fourth level (301510010000-301510010003)
-- STARO: 301510000000 (kolizija sa kontejnerom trećeg nivoa)
-- NOVO: 301510010000 (četvrti nivo, kao Ticketing 301510100000 i City 301510200000)
UPDATE permissions SET menu_order = 301510010000 WHERE name = 'transport.administration.central_points.main:view';
UPDATE permissions SET menu_order = 301510010001 WHERE name = 'transport.administration.central_points.main:create';
UPDATE permissions SET menu_order = 301510010002 WHERE name = 'transport.administration.central_points.main:update';
UPDATE permissions SET menu_order = 301510010003 WHERE name = 'transport.administration.central_points.main:delete';
