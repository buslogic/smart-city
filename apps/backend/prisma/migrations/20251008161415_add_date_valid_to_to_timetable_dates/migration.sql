-- Add date_valid_to column to timetable_dates table

ALTER TABLE `timetable_dates` ADD COLUMN `date_valid_to` VARCHAR(30) NULL AFTER `date_valid_from`;

-- Add index for date_valid_to
CREATE INDEX `idx_date_valid_to` ON `timetable_dates`(`date_valid_to`);
