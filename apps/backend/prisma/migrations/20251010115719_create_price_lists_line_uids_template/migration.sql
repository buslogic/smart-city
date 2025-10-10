-- CreateTable: Template tabela za dinamičko kreiranje price_lists_line_uids_XXXX_XX_XX tabela
-- Ova tabela služi kao template za kreiranje tabela sa stanicama na linijama za različite grupe cenovnika
-- Struktura je identična legacy tabeli price_lists_line_uids_XXXX_XX_XX

CREATE TABLE IF NOT EXISTS `price_lists_line_uids_template` (
    `price_tables_index_id` MEDIUMINT(6) UNSIGNED NOT NULL,
    `station_number` TINYINT(3) UNSIGNED NOT NULL DEFAULT 1,
    `station_uid` SMALLINT(5) UNSIGNED NOT NULL DEFAULT 0,
    `disable_show_on_public` TINYINT(1) NOT NULL DEFAULT 0,
    `pricelist_version` DATETIME NOT NULL,
    `active_flag` TINYINT(1) NOT NULL,
    `changed_by` SMALLINT(5) UNSIGNED NOT NULL DEFAULT 0,
    `change_date_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `transient_station` TINYINT(1) UNSIGNED NOT NULL DEFAULT 0,

    PRIMARY KEY (`price_tables_index_id`, `station_number`, `pricelist_version`, `active_flag`),
    KEY `idx_station_uid` (`station_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
