-- CreateTable: turnus_groups_assign
CREATE TABLE `turnus_groups_assign` (
    `turnus_id` MEDIUMINT NOT NULL,
    `group_id` SMALLINT NOT NULL,
    `changed_by` MEDIUMINT NOT NULL,
    `change_date` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    `date_from` DATETIME(0) NOT NULL DEFAULT '2023-11-01 00:00:00',
    `date_to` DATETIME(0) NOT NULL DEFAULT '2037-11-01 00:00:00',

    INDEX `turnus_groups_assign_turnus_id_idx`(`turnus_id`),
    INDEX `turnus_groups_assign_group_id_idx`(`group_id`),
    PRIMARY KEY (`turnus_id`, `group_id`, `date_from`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: turnus_days
CREATE TABLE `turnus_days` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `turnus_id` MEDIUMINT NOT NULL,
    `dayname` VARCHAR(20) NOT NULL,

    INDEX `turnus_days_turnus_id_idx`(`turnus_id`),
    INDEX `turnus_days_dayname_idx`(`dayname`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
