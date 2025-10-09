-- Drop existing tables if they exist from previous failed migration
DROP TABLE IF EXISTS `vremena_polaska_st`;
DROP TABLE IF EXISTS `vremena_polaska`;

-- CreateTable
CREATE TABLE `vremena_polaska` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `datum` DATE NOT NULL,
    `idlinije` VARCHAR(50) NOT NULL,
    `smer` TINYINT NOT NULL,
    `pon` TEXT NOT NULL,
    `uto` TEXT NOT NULL,
    `sre` TEXT NOT NULL,
    `cet` TEXT NOT NULL,
    `pet` TEXT NOT NULL,
    `sub` TEXT NOT NULL,
    `ned` TEXT NOT NULL,
    `dk1` TEXT NOT NULL,
    `dk1naziv` VARCHAR(20) NOT NULL,
    `dk2` TEXT NOT NULL,
    `dk2naziv` VARCHAR(20) NOT NULL,
    `dk3` TEXT NOT NULL,
    `dk3naziv` VARCHAR(20) NOT NULL,
    `dk4` TEXT NOT NULL,
    `dk4naziv` VARCHAR(20) NOT NULL,
    `variation` TINYINT NOT NULL DEFAULT 0,
    `datetime_from` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `datetime_to` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `variation_description` VARCHAR(100) NOT NULL DEFAULT '',
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `datum_2`(`datum`),
    INDEX `vremena_polaska_idlinije_idx`(`idlinije`),
    INDEX `vremena_polaska_smer_idx`(`smer`),
    UNIQUE INDEX `datum_idlinije_smer_datetime_from`(`datum`, `idlinije`, `smer`, `datetime_from`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vremena_polaska_st` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `datum` DATE NOT NULL,
    `idlinije` VARCHAR(40) NOT NULL DEFAULT '',
    `smer` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `dan` VARCHAR(3) NOT NULL DEFAULT '',
    `vreme` VARCHAR(5) NOT NULL DEFAULT '',
    `stanice` VARCHAR(3000) NOT NULL DEFAULT '',
    `opis` VARCHAR(200) NOT NULL DEFAULT '',
    `central_point` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `pauza` VARCHAR(200) NOT NULL DEFAULT '',
    `default_times` VARCHAR(400) NOT NULL DEFAULT '',
    `day_before` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `default_peron` VARCHAR(20) NOT NULL DEFAULT '',
    `num_departures` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `default_num_seats` TINYINT UNSIGNED NOT NULL DEFAULT 57,
    `timetable_short_comments_id` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `vehicle_chassis_types_id` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `gtfs_trip_id` VARCHAR(50) NOT NULL DEFAULT '',
    `service_id` VARCHAR(50) NOT NULL DEFAULT '',
    `not_official` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `comp_code` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `vehicle_group_types_id` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `turage_no` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `departure_no_in_turage` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `datum_2`(`datum`),
    INDEX `idlinije_3`(`idlinije`),
    INDEX `gtfs_trip_id`(`gtfs_trip_id`),
    INDEX `service_id`(`service_id`),
    INDEX `datum_dan_vreme`(`datum`, `dan`, `vreme`),
    INDEX `datum_idlinije_dan_vreme_service_id`(`datum`, `idlinije`, `dan`, `vreme`, `service_id`),
    INDEX `idlinije_cp_dan`(`idlinije`, `central_point`, `dan`),
    UNIQUE INDEX `datum`(`idlinije`, `smer`, `dan`, `vreme`, `central_point`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
