-- CreateTable
CREATE TABLE `price_variations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `variation_name` VARCHAR(250) NOT NULL,
    `variation_description` VARCHAR(255) NOT NULL,
    `gtfs_route_settings_id` VARCHAR(250) NULL,
    `direction` VARCHAR(10) NULL,
    `main_basic_route` BOOLEAN NULL,
    `datetime_from` DATETIME(3) NULL,
    `datetime_to` DATETIME(3) NULL,
    `line_type_id` INTEGER NOT NULL,
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `legacy_ticketing_id` BIGINT NULL,
    `legacy_city_id` BIGINT NULL,

    UNIQUE INDEX `price_variations_legacy_ticketing_id_key`(`legacy_ticketing_id`),
    UNIQUE INDEX `price_variations_legacy_city_id_key`(`legacy_city_id`),
    INDEX `price_variations_variation_name_idx`(`variation_name`),
    INDEX `price_variations_line_type_id_idx`(`line_type_id`),
    INDEX `price_variations_legacy_ticketing_id_idx`(`legacy_ticketing_id`),
    INDEX `price_variations_legacy_city_id_idx`(`legacy_city_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

