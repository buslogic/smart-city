-- Rename legacy_sync permissions to follow the standard format: legacy.sync:action
-- Also rename legacy_sync.manage to legacy.sync:configure for consistency

-- Update permission names and resources
UPDATE permissions 
SET 
  name = 'legacy.sync:view',
  resource = 'legacy.sync'
WHERE name = 'legacy_sync.view';

UPDATE permissions 
SET 
  name = 'legacy.sync:start',
  resource = 'legacy.sync'
WHERE name = 'legacy_sync.start';

UPDATE permissions 
SET 
  name = 'legacy.sync:stop',
  resource = 'legacy.sync'
WHERE name = 'legacy_sync.stop';

-- Rename manage to configure for consistency
UPDATE permissions 
SET 
  name = 'legacy.sync:configure',
  resource = 'legacy.sync',
  action = 'configure',
  description = 'Konfiguracija Legacy Sync parametara'
WHERE name = 'legacy_sync.manage';