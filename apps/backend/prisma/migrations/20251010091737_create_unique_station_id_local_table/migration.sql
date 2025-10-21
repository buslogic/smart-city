-- CreateTable
CREATE TABLE `unique_station_id_local` (
  `unique_id` varchar(5) NOT NULL,
  `station_name` varchar(50) NOT NULL,
  `gpsx` decimal(15,10) NOT NULL,
  `gpsy` decimal(15,10) NOT NULL,
  `description` varchar(500) NOT NULL,
  `range` int(6) NOT NULL DEFAULT '20',
  `range_for_driver_console` int(6) NOT NULL DEFAULT '20',
  `range_for_validators` int(6) NOT NULL DEFAULT '20',
  `changed` tinyint(1) NOT NULL,
  `main_operator` tinyint(1) NOT NULL,
  `group_id` tinyint(2) unsigned NOT NULL,
  `ready_for_booking` tinyint(2) NOT NULL DEFAULT '0',
  `used_in_booking` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `date_valid_from` date DEFAULT NULL,
  PRIMARY KEY (`unique_id`),
  KEY `station_name` (`station_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
