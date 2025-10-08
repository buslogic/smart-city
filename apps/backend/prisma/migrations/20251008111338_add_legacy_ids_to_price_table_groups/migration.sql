-- Add legacy_ticketing_id and legacy_city_id columns to price_table_groups

-- AlterTable
ALTER TABLE `price_table_groups`
  ADD COLUMN `legacy_ticketing_id` BIGINT NULL,
  ADD COLUMN `legacy_city_id` BIGINT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `price_table_groups_legacy_ticketing_id_key` ON `price_table_groups`(`legacy_ticketing_id`);

-- CreateIndex
CREATE UNIQUE INDEX `price_table_groups_legacy_city_id_key` ON `price_table_groups`(`legacy_city_id`);

-- CreateIndex
CREATE INDEX `idx_legacy_ticketing_id` ON `price_table_groups`(`legacy_ticketing_id`);

-- CreateIndex
CREATE INDEX `idx_legacy_city_id` ON `price_table_groups`(`legacy_city_id`);
