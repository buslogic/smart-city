-- AlterTable
ALTER TABLE `lines` MODIFY `time_from_by_line` time NOT NULL DEFAULT '00:00:00',
    MODIFY `time_to_by_line` time NOT NULL DEFAULT '23:59:59';

