-- Add legacy ID columns for sync tracking
ALTER TABLE `unique_station_id_local`
  ADD COLUMN `legacy_ticketing_id` BIGINT NULL UNIQUE,
  ADD COLUMN `legacy_city_id` BIGINT NULL UNIQUE;
