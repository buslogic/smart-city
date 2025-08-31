-- CreateTable
CREATE TABLE `legacy_city_gps_current` (
    `garage_no` VARCHAR(15) NOT NULL,
    `lat` DECIMAL(11, 8) NOT NULL,
    `lng` DECIMAL(11, 8) NOT NULL,
    `course` SMALLINT NOT NULL,
    `speed` SMALLINT NOT NULL,
    `alt` SMALLINT NOT NULL,
    `state` TINYINT NOT NULL,
    `line_number` VARCHAR(5) NULL,
    `trip_type` TINYINT NOT NULL,
    `direction` TINYINT NOT NULL,
    `in_route` TINYINT NOT NULL,
    `captured` DATETIME(3) NOT NULL,
    `edited` DATETIME(3) NOT NULL,
    `people_counter_in` INTEGER NOT NULL DEFAULT 0,
    `people_counter_out` INTEGER NOT NULL DEFAULT 0,
    `iot_voltage` INTEGER NULL,
    `iot_ignition` INTEGER NULL,
    `battery_status` TINYINT NULL,
    `vehicle_id` INTEGER NULL,
    `last_update` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `data_source` VARCHAR(191) NOT NULL DEFAULT 'cron',

    INDEX `legacy_city_gps_current_line_number_idx`(`line_number`),
    INDEX `legacy_city_gps_current_captured_idx`(`captured`),
    INDEX `legacy_city_gps_current_vehicle_id_idx`(`vehicle_id`),
    PRIMARY KEY (`garage_no`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `legacy_city_gps_current` ADD CONSTRAINT `legacy_city_gps_current_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `bus_vehicles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
