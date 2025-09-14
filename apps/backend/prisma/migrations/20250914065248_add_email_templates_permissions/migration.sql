-- Add email templates permissions
INSERT INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at)
VALUES
  ('settings.email_templates:view', 'settings.email_templates', 'view', 'View email templates', 'Pregled email šablona', 'settings', NOW(), NOW()),
  ('settings.email_templates:create', 'settings.email_templates', 'create', 'Create email templates', 'Kreiranje email šablona', 'settings', NOW(), NOW()),
  ('settings.email_templates:update', 'settings.email_templates', 'update', 'Update email templates', 'Izmena email šablona', 'settings', NOW(), NOW()),
  ('settings.email_templates:delete', 'settings.email_templates', 'delete', 'Delete email templates', 'Brisanje email šablona', 'settings', NOW(), NOW()),
  ('settings.email_templates:test', 'settings.email_templates', 'test', 'Test email templates', 'Testiranje email šablona', 'settings', NOW(), NOW());