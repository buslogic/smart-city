-- DropForeignKey
ALTER TABLE `safety_score_config_history` DROP FOREIGN KEY `fk_config_history_config`;

-- DropForeignKey
ALTER TABLE `safety_score_config_history` DROP FOREIGN KEY `fk_config_history_user`;

-- DropIndex
DROP INDEX `idx_changed_by` ON `safety_score_config_history`;

-- DropIndex
DROP INDEX `idx_config_id` ON `safety_score_config_history`;

-- AlterTable
ALTER TABLE `safety_score_config` MODIFY `event_type` VARCHAR(50) NOT NULL,
    MODIFY `severity` VARCHAR(20) NOT NULL,
    ALTER COLUMN `threshold_events` DROP DEFAULT,
    ALTER COLUMN `threshold_distance_km` DROP DEFAULT,
    ALTER COLUMN `penalty_points` DROP DEFAULT,
    ALTER COLUMN `penalty_multiplier` DROP DEFAULT,
    MODIFY `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `safety_score_config_history` MODIFY `change_type` VARCHAR(20) NOT NULL,
    MODIFY `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `safety_score_global_config` MODIFY `updated_at` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `user_dashboard_widgets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `config_id` INTEGER NOT NULL,
    `widget_id` VARCHAR(50) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `order` INTEGER NOT NULL DEFAULT 0,
    `config` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `user_dashboard_widgets_config_id_idx`(`config_id`),
    UNIQUE INDEX `user_dashboard_widgets_config_id_widget_id_key`(`config_id`, `widget_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `safety_score_config_history` ADD CONSTRAINT `safety_score_config_history_config_id_fkey` FOREIGN KEY (`config_id`) REFERENCES `safety_score_config`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `safety_score_config_history` ADD CONSTRAINT `safety_score_config_history_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_dashboard_widgets` ADD CONSTRAINT `user_dashboard_widgets_config_id_fkey` FOREIGN KEY (`config_id`) REFERENCES `user_dashboard_configs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `safety_score_config` RENAME INDEX `unique_event_severity` TO `safety_score_config_event_type_severity_key`;

-- RenameIndex
ALTER TABLE `safety_score_global_config` RENAME INDEX `unique_parameter` TO `safety_score_global_config_parameter_name_key`;

