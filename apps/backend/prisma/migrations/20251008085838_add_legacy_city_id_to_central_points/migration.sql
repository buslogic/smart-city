-- Add legacy_city_id field for City Server sync tracking

-- AlterTable
ALTER TABLE `central_points` ADD COLUMN `legacy_city_id` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `central_points_legacy_city_id_key` ON `central_points`(`legacy_city_id`);

-- CreateIndex
CREATE INDEX `central_points_legacy_city_id_idx` ON `central_points`(`legacy_city_id`);
