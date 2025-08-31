-- CreateTable
CREATE TABLE `legacy_table_mappings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `legacy_database_id` INTEGER NOT NULL,
    `legacy_table_name` VARCHAR(191) NOT NULL,
    `local_table_name` VARCHAR(191) NOT NULL,
    `mapping_type` VARCHAR(191) NOT NULL DEFAULT 'one_way',
    `sync_enabled` BOOLEAN NOT NULL DEFAULT false,
    `sync_frequency` VARCHAR(191) NULL,
    `last_sync_at` DATETIME(3) NULL,
    `last_sync_status` VARCHAR(191) NULL,
    `last_sync_message` TEXT NULL,
    `mapping_config` TEXT NULL,
    `description` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `legacy_table_mappings_legacy_database_id_idx`(`legacy_database_id`),
    UNIQUE INDEX `legacy_table_mappings_legacy_database_id_legacy_table_name_l_key`(`legacy_database_id`, `legacy_table_name`, `local_table_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `legacy_table_mappings` ADD CONSTRAINT `legacy_table_mappings_legacy_database_id_fkey` FOREIGN KEY (`legacy_database_id`) REFERENCES `legacy_databases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
