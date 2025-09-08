-- DropIndex
DROP INDEX `idx_garage_timestamp` ON `gps_raw_buffer`;

-- DropIndex
DROP INDEX `idx_processing` ON `gps_raw_buffer`;

-- DropIndex
DROP INDEX `idx_status_received` ON `gps_raw_buffer`;

-- CreateIndex
CREATE INDEX `idx_status_only` ON `gps_raw_buffer`(`process_status`);

-- CreateIndex
CREATE INDEX `idx_worker_select` ON `gps_raw_buffer`(`process_status`, `retry_count`, `received_at`);

-- CreateIndex
CREATE INDEX `idx_cleanup` ON `gps_raw_buffer`(`processed_at`, `process_status`);

-- Analyze table to update statistics (CRITICAL for 5M+ records)
ANALYZE TABLE `gps_raw_buffer`;

