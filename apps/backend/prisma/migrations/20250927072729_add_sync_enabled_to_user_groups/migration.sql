-- AlterTable
ALTER TABLE `user_groups` ADD COLUMN `sync_enabled` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `user_groups_sync_enabled_idx` ON `user_groups`(`sync_enabled`);

