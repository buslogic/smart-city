-- CreateTable
CREATE TABLE `gps_raw_buffer` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `vehicle_id` INTEGER NULL,
    `garage_no` VARCHAR(20) NOT NULL,
    `imei` VARCHAR(50) NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `lat` DECIMAL(10, 8) NOT NULL,
    `lng` DECIMAL(11, 8) NOT NULL,
    `speed` INTEGER NOT NULL DEFAULT 0,
    `course` INTEGER NOT NULL DEFAULT 0,
    `altitude` INTEGER NOT NULL DEFAULT 0,
    `satellites` INTEGER NOT NULL DEFAULT 0,
    `state` INTEGER NOT NULL DEFAULT 0,
    `in_route` INTEGER NOT NULL DEFAULT 0,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,
    `process_status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,
    `source` VARCHAR(50) NOT NULL DEFAULT 'legacy',

    INDEX `idx_status_received`(`process_status`, `received_at`),
    INDEX `idx_vehicle_timestamp`(`vehicle_id`, `timestamp`),
    INDEX `idx_processing`(`process_status`, `retry_count`),
    INDEX `idx_garage_timestamp`(`garage_no`, `timestamp`),
    INDEX `idx_received_at`(`received_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
