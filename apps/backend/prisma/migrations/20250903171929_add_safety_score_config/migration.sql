-- Kreiranje tabele za Safety Score konfiguraciju
CREATE TABLE IF NOT EXISTS `safety_score_config` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `event_type` ENUM('harsh_acceleration', 'harsh_braking') NOT NULL,
  `severity` ENUM('severe', 'moderate') NOT NULL,
  `threshold_events` INT NOT NULL DEFAULT 5 COMMENT 'Broj događaja koji se tolerišu',
  `threshold_distance_km` INT NOT NULL DEFAULT 100 COMMENT 'Distanca za računanje (obično 100km)',
  `penalty_points` DECIMAL(5,2) NOT NULL DEFAULT 10.00 COMMENT 'Koliko poena se oduzima kada se prekorači threshold',
  `penalty_multiplier` DECIMAL(5,2) NOT NULL DEFAULT 1.00 COMMENT 'Množilac za progresivnu kaznu',
  `max_penalty` DECIMAL(5,2) DEFAULT NULL COMMENT 'Maksimalna kazna za ovu kategoriju',
  `description` TEXT COMMENT 'Opis pravila',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_event_severity` (`event_type`, `severity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Početni podaci sa razumnim vrednostima
INSERT INTO `safety_score_config` (`event_type`, `severity`, `threshold_events`, `threshold_distance_km`, `penalty_points`, `penalty_multiplier`, `max_penalty`, `description`) VALUES
-- Ozbiljno ubrzanje
('harsh_acceleration', 'severe', 2, 100, 15.00, 2.00, 25.00, 'Ozbiljna nagla ubrzanja - visoka kazna'),
-- Umereno ubrzanje  
('harsh_acceleration', 'moderate', 10, 100, 5.00, 1.50, 15.00, 'Umerena nagla ubrzanja - srednja kazna'),
-- Ozbiljno kočenje
('harsh_braking', 'severe', 2, 100, 15.00, 2.00, 25.00, 'Ozbiljna nagla kočenja - visoka kazna'),
-- Umereno kočenje
('harsh_braking', 'moderate', 10, 100, 5.00, 1.50, 15.00, 'Umerena nagla kočenja - srednja kazna');

-- Tabela za praćenje istorije promena
CREATE TABLE IF NOT EXISTS `safety_score_config_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `config_id` INT NOT NULL,
  `changed_by` INT DEFAULT NULL,
  `change_type` ENUM('UPDATE', 'DELETE', 'DEACTIVATE') NOT NULL,
  `old_values` JSON DEFAULT NULL,
  `new_values` JSON DEFAULT NULL,
  `changed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_config_id` (`config_id`),
  KEY `idx_changed_by` (`changed_by`),
  CONSTRAINT `fk_config_history_config` FOREIGN KEY (`config_id`) REFERENCES `safety_score_config` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_config_history_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dodatna tabela za globalne postavke
CREATE TABLE IF NOT EXISTS `safety_score_global_config` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `parameter_name` VARCHAR(100) NOT NULL,
  `parameter_value` DECIMAL(10,2) NOT NULL,
  `description` TEXT,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_parameter` (`parameter_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Globalni parametri
INSERT INTO `safety_score_global_config` (`parameter_name`, `parameter_value`, `description`) VALUES
('base_score', 100.00, 'Početni score pre kalkulacije kazni'),
('min_score', 0.00, 'Minimalni mogući score'),
('max_score', 100.00, 'Maksimalni mogući score'),
('distance_normalization', 100.00, 'Normalizacija distance (npr. na 100km)');