-- Add remaining CRUD permissions for User Groups

INSERT IGNORE INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at)
VALUES
  ('users.groups:create', 'users.groups', 'create', 'Create user groups', 'Kreiranje grupa korisnika', 'users', NOW(), NOW()),
  ('users.groups:edit', 'users.groups', 'edit', 'Edit user groups', 'Izmena grupa korisnika', 'users', NOW(), NOW()),
  ('users.groups:delete', 'users.groups', 'delete', 'Delete user groups', 'Brisanje grupa korisnika', 'users', NOW(), NOW());