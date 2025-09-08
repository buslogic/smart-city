-- CreateTable
CREATE TABLE `gps_batch_history` (
    `id` VARCHAR(191) NOT NULL,
    `batch_number` INTEGER NOT NULL,
    `started_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,
    `status` VARCHAR(20) NOT NULL,
    `batch_size` INTEGER NOT NULL,
    `actual_processed` INTEGER NOT NULL DEFAULT 0,
    `failed_records` INTEGER NOT NULL DEFAULT 0,
    `worker_count` INTEGER NOT NULL,
    `worker_details` JSON NULL,
    `total_duration_ms` INTEGER NULL,
    `avg_records_per_second` DOUBLE NULL,
    `source_table` VARCHAR(50) NULL,
    `cron_interval` INTEGER NULL,
    `error_message` TEXT NULL,
    `error_details` JSON NULL,
    `processed_by` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `gps_batch_history_started_at_idx`(`started_at`),
    INDEX `gps_batch_history_status_idx`(`status`),
    INDEX `gps_batch_history_batch_number_idx`(`batch_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;