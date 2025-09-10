-- Delete roles:manage permission as it's not used
DELETE FROM permissions WHERE name = 'roles:manage';