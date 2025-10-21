-- CreateTable: timetable_dates (identična struktura kao price_table_groups)

CREATE TABLE IF NOT EXISTS `timetable_dates` (
  `id` BIGINT(10) NOT NULL AUTO_INCREMENT,
  `date_valid_from` VARCHAR(30) NOT NULL,
  `status` VARCHAR(2) NOT NULL DEFAULT 'N',
  `synchro_status` VARCHAR(5) NOT NULL DEFAULT 'N',
  `send_incremental` VARCHAR(5) NOT NULL DEFAULT '0',
  `changed_by` VARCHAR(100) NOT NULL,
  `date_time` DATETIME NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `legacy_ticketing_id` BIGINT(10) NULL,
  `legacy_city_id` BIGINT(10) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_date_valid_from` (`date_valid_from`),
  UNIQUE KEY `timetable_dates_legacy_ticketing_id_key` (`legacy_ticketing_id`),
  UNIQUE KEY `timetable_dates_legacy_city_id_key` (`legacy_city_id`),
  KEY `idx_status` (`status`),
  KEY `idx_synchro_status` (`synchro_status`),
  KEY `idx_legacy_ticketing_id` (`legacy_ticketing_id`),
  KEY `idx_legacy_city_id` (`legacy_city_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
