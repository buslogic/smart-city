-- AlterTable
ALTER TABLE `gps_raw_buffer` ADD COLUMN `worker_group` TINYINT NULL;

-- Popuni worker_group za postojeće redove
UPDATE `gps_raw_buffer` 
SET `worker_group` = MOD(`vehicle_id`, 8)
WHERE `worker_group` IS NULL;

-- CreateIndex
CREATE INDEX `idx_worker_group` ON `gps_raw_buffer`(`worker_group`, `process_status`, `retry_count`);

