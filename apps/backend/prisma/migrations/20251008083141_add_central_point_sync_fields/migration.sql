-- AlterTable
ALTER TABLE `central_points` ADD COLUMN `legacy_ticketing_id` INTEGER NULL,
    ADD COLUMN `sync_source` ENUM('manual', 'ticketing_sync') NULL DEFAULT 'manual';

-- CreateIndex
CREATE UNIQUE INDEX `central_points_legacy_ticketing_id_key` ON `central_points`(`legacy_ticketing_id`);

-- CreateIndex
CREATE INDEX `central_points_legacy_ticketing_id_idx` ON `central_points`(`legacy_ticketing_id`);

