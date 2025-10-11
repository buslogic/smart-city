-- CreateTable
CREATE TABLE `turnus_groups_names` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `active` BOOLEAN NOT NULL,
    `changed_by` MEDIUMINT NOT NULL,
    `change_date` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    `date_valid_from` DATE NOT NULL,

    INDEX `turnus_groups_names_active_idx`(`active`),
    INDEX `turnus_groups_names_date_valid_from_idx`(`date_valid_from`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
