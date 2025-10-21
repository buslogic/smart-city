-- AlterTable
ALTER TABLE `central_points` ADD COLUMN `sync_with_city_server` BOOLEAN NOT NULL DEFAULT false AFTER `sync_source`;
