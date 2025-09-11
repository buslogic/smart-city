-- GPS Ingest permisija za API Keys sistem

-- Dodavanje gps:ingest permisije
INSERT INTO permissions (name, resource, action, description, description_sr, category, created_at, updated_at) 
VALUES 
  ('gps:ingest', 'gps', 'ingest', 'GPS Data Ingestion', 'Prijem GPS podataka', 'GPS', NOW(), NOW());