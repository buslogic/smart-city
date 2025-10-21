-- CreateTable: price_table_groups (identična struktura kao na Ticketing serveru 79.101.48.10)

CREATE TABLE IF NOT EXISTS `price_table_groups` (
  `id` BIGINT(10) NOT NULL AUTO_INCREMENT,
  `date_valid_from` DATE NOT NULL,
  `status` VARCHAR(2) NOT NULL DEFAULT 'N',
  `synchro_status` VARCHAR(5) NOT NULL DEFAULT 'N',
  `send_incremental` VARCHAR(5) NOT NULL DEFAULT '0',
  `changed_by` VARCHAR(100) NOT NULL,
  `date_time` DATETIME NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_date_valid_from` (`date_valid_from`),
  KEY `idx_status` (`status`),
  KEY `idx_synchro_status` (`synchro_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
