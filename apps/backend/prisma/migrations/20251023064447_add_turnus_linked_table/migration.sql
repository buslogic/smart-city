-- DropTable (from failed migration)
DROP TABLE IF EXISTS `turnus_linked`;

-- CreateTable
CREATE TABLE `turnus_linked` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `line_number_1` VARCHAR(6) NOT NULL,
    `turnus_id_1` MEDIUMINT UNSIGNED NOT NULL,
    `turnus_name_1` VARCHAR(320) NOT NULL,
    `line_number_2` VARCHAR(6) NOT NULL,
    `turnus_id_2` MEDIUMINT UNSIGNED NOT NULL,
    `turnus_name_2` VARCHAR(320) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `created_by` INTEGER NOT NULL,
    `updated_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `turnus_linked_line_number_1_idx`(`line_number_1`),
    INDEX `turnus_linked_line_number_2_idx`(`line_number_2`),
    INDEX `turnus_linked_status_idx`(`status`),
    INDEX `turnus_linked_created_by_idx`(`created_by`),
    INDEX `turnus_linked_updated_by_idx`(`updated_by`),
    UNIQUE INDEX `turnus_linked_line_number_1_turnus_id_1_line_number_2_turnus_key`(`line_number_1`, `turnus_id_1`, `line_number_2`, `turnus_id_2`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `turnus_linked` ADD CONSTRAINT `turnus_linked_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turnus_linked` ADD CONSTRAINT `turnus_linked_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
