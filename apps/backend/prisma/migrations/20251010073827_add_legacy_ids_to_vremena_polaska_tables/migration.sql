-- Add legacy_ticketing_id and legacy_city_id to vremena_polaska
ALTER TABLE `vremena_polaska` ADD COLUMN `legacy_ticketing_id` BIGINT NULL;
ALTER TABLE `vremena_polaska` ADD COLUMN `legacy_city_id` BIGINT NULL;

-- Add indexes
CREATE INDEX `vremena_polaska_legacy_ticketing_id_idx` ON `vremena_polaska`(`legacy_ticketing_id`);
CREATE INDEX `vremena_polaska_legacy_city_id_idx` ON `vremena_polaska`(`legacy_city_id`);

-- Add legacy_ticketing_id and legacy_city_id to vremena_polaska_st
ALTER TABLE `vremena_polaska_st` ADD COLUMN `legacy_ticketing_id` BIGINT NULL;
ALTER TABLE `vremena_polaska_st` ADD COLUMN `legacy_city_id` BIGINT NULL;

-- Add indexes
CREATE INDEX `vremena_polaska_st_legacy_ticketing_id_idx` ON `vremena_polaska_st`(`legacy_ticketing_id`);
CREATE INDEX `vremena_polaska_st_legacy_city_id_idx` ON `vremena_polaska_st`(`legacy_city_id`);
