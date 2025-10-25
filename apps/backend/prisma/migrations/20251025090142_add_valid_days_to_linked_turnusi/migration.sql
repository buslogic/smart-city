-- AlterTable
ALTER TABLE `turnus_linked` ADD COLUMN `valid_friday` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `valid_monday` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `valid_saturday` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `valid_sunday` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `valid_thursday` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `valid_tuesday` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `valid_wednesday` BOOLEAN NOT NULL DEFAULT true;
