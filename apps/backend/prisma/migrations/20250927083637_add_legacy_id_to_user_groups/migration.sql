-- AlterTable
ALTER TABLE `user_groups` ADD COLUMN `legacy_id` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `user_groups_legacy_id_key` ON `user_groups`(`legacy_id`);

-- CreateIndex
CREATE INDEX `user_groups_legacy_id_idx` ON `user_groups`(`legacy_id`);