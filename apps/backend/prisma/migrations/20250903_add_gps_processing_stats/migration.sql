-- CreateTable
CREATE TABLE IF NOT EXISTS `gps_processing_stats` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hour_slot` DATETIME(3) NOT NULL,
    `received_count` INTEGER NOT NULL DEFAULT 0,
    `processed_count` INTEGER NOT NULL DEFAULT 0,
    `avg_processing_time_ms` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `gps_processing_stats_hour_slot_key`(`hour_slot`),
    INDEX `idx_hour_slot`(`hour_slot`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;