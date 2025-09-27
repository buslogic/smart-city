-- AlterTable
ALTER TABLE `users` ADD COLUMN `legacy_id` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_legacy_id_key` ON `users`(`legacy_id`);

-- CreateIndex
CREATE INDEX `users_legacy_id_idx` ON `users`(`legacy_id`);