-- AlterTable
ALTER TABLE `price_table_groups` MODIFY `date_time` datetime NOT NULL;

-- AlterTable
ALTER TABLE `lines` MODIFY `date_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE `timetable_dates` MODIFY `date_time` datetime NOT NULL;
