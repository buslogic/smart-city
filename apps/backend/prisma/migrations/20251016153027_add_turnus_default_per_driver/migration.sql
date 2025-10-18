-- CreateEnum
-- Kreira enum za dane u nedelji
-- Note: MySQL ne podržava ENUM na nivou baze, Prisma će koristiti VARCHAR

-- CreateTable
CREATE TABLE `turnus_default_per_driver` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `driver_id` INTEGER NOT NULL,
    `turnus_name` VARCHAR(50) NOT NULL,
    `line_number_for_display` VARCHAR(10) NULL,
    `shift_number` TINYINT NULL,
    `day_of_week` ENUM('Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja') NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `usage_count` INTEGER NOT NULL DEFAULT 0,
    `usage_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `last_used_date` DATE NULL,
    `auto_generated` BOOLEAN NOT NULL DEFAULT false,
    `confidence_score` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` INTEGER NULL,
    `updated_by` INTEGER NULL,

    INDEX `tdpd_driver_id_is_active_idx`(`driver_id`, `is_active`),
    INDEX `tdpd_turnus_line_idx`(`turnus_name`, `line_number_for_display`),
    INDEX `tdpd_priority_idx`(`priority`),
    INDEX `tdpd_auto_gen_conf_idx`(`auto_generated`, `confidence_score`),
    UNIQUE INDEX `unique_driver_turnus_config`(`driver_id`, `turnus_name`, `line_number_for_display`, `shift_number`, `day_of_week`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `turnus_default_per_driver` ADD CONSTRAINT `turnus_default_per_driver_driver_id_fkey` FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turnus_default_per_driver` ADD CONSTRAINT `turnus_default_per_driver_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turnus_default_per_driver` ADD CONSTRAINT `turnus_default_per_driver_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
