-- DropForeignKey
ALTER TABLE `vodovod_water_meter` DROP FOREIGN KEY `FK_vodovod_water_meter_type_id`;

-- DropForeignKey
ALTER TABLE `vodovod_water_meter` DROP FOREIGN KEY `FK_vodovod_water_meter_availability_id`;

-- DropForeignKey
ALTER TABLE `vodovod_water_meter` DROP FOREIGN KEY `FK_vodovod_water_meter_manufacturer_id`;

-- DropForeignKey
ALTER TABLE `vodovod_replaced_water_meter` DROP FOREIGN KEY `fk_replaced_water_meter_original`;

-- DropForeignKey
ALTER TABLE `vodovod_replaced_water_meter` DROP FOREIGN KEY `vodovod_replaced_water_meter_type_fkey`;

-- DropForeignKey
ALTER TABLE `vodovod_replaced_water_meter` DROP FOREIGN KEY `vodovod_replaced_water_meter_availability_fkey`;

-- DropForeignKey
ALTER TABLE `vodovod_replaced_water_meter` DROP FOREIGN KEY `vodovod_replaced_water_meter_manufacturer_fkey`;

-- DropForeignKey
ALTER TABLE `ordering_addresses` DROP FOREIGN KEY `FK_ordering_addresses_city_id`;

-- DropForeignKey
ALTER TABLE `ordering_addresses` DROP FOREIGN KEY `FK_ordering_addresses_zone_id`;

-- DropForeignKey
ALTER TABLE `vodovod_zones` DROP FOREIGN KEY `FK_vodovod_zones_region_id`;

-- DropForeignKey
ALTER TABLE `vodovod_measuring_points` DROP FOREIGN KEY `FK_vodovod_measuring_points_address_id`;

-- DropForeignKey
ALTER TABLE `vodovod_measuring_points` DROP FOREIGN KEY `FK_vodovod_measuring_points_zone_id`;

-- DropIndex
DROP INDEX `vodovod_water_meter_idv_key` ON `vodovod_water_meter`;

-- DropIndex
DROP INDEX `vodovod_replaced_water_meter_idv_key` ON `vodovod_replaced_water_meter`;

-- AlterTable
ALTER TABLE `vodovod_water_meter` MODIFY `calibrated_from` date NULL,
    MODIFY `calibrated_to` date NULL,
    MODIFY `disconnection_date` date NULL,
    MODIFY `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updated_at` datetime(3) NOT NULL;

-- AlterTable
ALTER TABLE `vodovod_replaced_water_meter` DROP COLUMN `aktivan`,
    DROP COLUMN `disconnection_date`,
    MODIFY `calibrated_from` date NULL,
    MODIFY `calibrated_to` date NULL,
    MODIFY `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updated_at` datetime(3) NOT NULL;

-- AlterTable
ALTER TABLE `vodovod_water_meter_readings` ADD COLUMN `availability` VARCHAR(255) NULL,
    MODIFY `meter_reading` varchar(255) NOT NULL DEFAULT '-',
    MODIFY `faulty` int NOT NULL DEFAULT 0,
    MODIFY `unreadable` int NOT NULL DEFAULT 0,
    MODIFY `not_found_on_site` int NOT NULL DEFAULT 0,
    MODIFY `no_meter` int NOT NULL DEFAULT 0,
    MODIFY `negative_consumption` int NOT NULL DEFAULT 0,
    MODIFY `transfer_to_next_cl` int NOT NULL DEFAULT 0,
    MODIFY `bill_printout` int NOT NULL DEFAULT 0,
    MODIFY `canceled` int NOT NULL DEFAULT 0,
    MODIFY `priority` int NOT NULL DEFAULT 0,
    MODIFY `average` int NOT NULL DEFAULT 0,
    MODIFY `meter_reader_only` int NOT NULL DEFAULT 0,
    MODIFY `disconnected` int NOT NULL DEFAULT 0,
    MODIFY `census_select` int NOT NULL DEFAULT 0,
    MODIFY `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updated_at` datetime(3) NOT NULL;

-- DropTable
DROP TABLE `ordering_cities`;

-- DropTable
DROP TABLE `ordering_addresses`;

-- DropTable
DROP TABLE `vodovod_regions`;

-- DropTable
DROP TABLE `vodovod_zones`;

-- DropTable
DROP TABLE `vodovod_measuring_points`;

-- CreateIndex
CREATE INDEX `vodovod_water_meter_idv_idx` ON `vodovod_water_meter`(`idv` ASC);

-- CreateIndex
CREATE INDEX `vodovod_replaced_water_meter_availability_idx` ON `vodovod_replaced_water_meter`(`availability` ASC);

-- CreateIndex
CREATE INDEX `vodovod_replaced_water_meter_idmm_idx` ON `vodovod_replaced_water_meter`(`idmm` ASC);

-- CreateIndex
CREATE INDEX `vodovod_replaced_water_meter_manufacturer_idx` ON `vodovod_replaced_water_meter`(`manufacturer` ASC);

-- CreateIndex
CREATE INDEX `vodovod_replaced_water_meter_type_idx` ON `vodovod_replaced_water_meter`(`type` ASC);

-- CreateIndex
CREATE INDEX `vodovod_water_meter_readings_meter_reading_idx` ON `vodovod_water_meter_readings`(`meter_reading` ASC);

-- CreateIndex
CREATE INDEX `vodovod_water_meter_readings_user_account_idx` ON `vodovod_water_meter_readings`(`user_account` ASC);

-- RenameIndex
ALTER TABLE `vodovod_water_meter` RENAME INDEX `FK_vodovod_water_meter_type_id` TO `vodovod_water_meter_type_id_idx`;

-- RenameIndex
ALTER TABLE `vodovod_water_meter` RENAME INDEX `FK_vodovod_water_meter_availability_id` TO `vodovod_water_meter_availability_id_idx`;

-- RenameIndex
ALTER TABLE `vodovod_water_meter` RENAME INDEX `FK_vodovod_water_meter_manufacturer_id` TO `vodovod_water_meter_manufacturer_id_idx`;

-- RenameIndex
ALTER TABLE `vodovod_water_meter` RENAME INDEX `fk_idmm` TO `vodovod_water_meter_idmm_idx`;

-- RenameIndex
ALTER TABLE `vodovod_replaced_water_meter` RENAME INDEX `fk_replaced_water_meter_original` TO `vodovod_replaced_water_meter_replaced_id_idx`;

