-- Ručno brisanje API Keys tabela za rešavanje problema migracije
DROP TABLE IF EXISTS api_key_logs;
DROP TABLE IF EXISTS api_keys;