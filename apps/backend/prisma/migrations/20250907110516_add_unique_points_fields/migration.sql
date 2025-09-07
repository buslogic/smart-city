-- AlterTable
ALTER TABLE `smart_slow_sync_vehicles` ADD COLUMN `last_points_check` DATETIME(3) NULL,
    ADD COLUMN `unique_points_in_db` BIGINT NOT NULL DEFAULT 0;