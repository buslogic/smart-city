-- AlterTable
ALTER TABLE `users` ADD COLUMN `user_group_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `user_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `group_name` VARCHAR(100) NOT NULL,
    `driver` BOOLEAN NOT NULL DEFAULT false,
    `user_class` INTEGER NOT NULL DEFAULT 1,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_groups_group_name_key`(`group_name`),
    INDEX `user_groups_group_name_idx`(`group_name`),
    INDEX `user_groups_driver_idx`(`driver`),
    INDEX `user_groups_user_class_idx`(`user_class`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `users_user_group_id_idx` ON `users`(`user_group_id`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_user_group_id_fkey` FOREIGN KEY (`user_group_id`) REFERENCES `user_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

