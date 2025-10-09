-- Fix schema drift: Add missing UNIQUE constraint and remove duplicate indexes
-- Note: Must handle FK constraint carefully

-- Step 1: Temporarily drop FK constraint from lines table
ALTER TABLE `lines` DROP FOREIGN KEY `lines_date_valid_from_fkey`;

-- Step 2: price_table_groups - Replace regular KEY with UNIQUE constraint
ALTER TABLE `price_table_groups` DROP INDEX `idx_date_valid_from`;
ALTER TABLE `price_table_groups` ADD CONSTRAINT `unique_date_valid_from` UNIQUE (`date_valid_from`);

-- Step 3: Re-create FK constraint (now references UNIQUE constraint index)
ALTER TABLE `lines` ADD CONSTRAINT `lines_date_valid_from_fkey` 
  FOREIGN KEY (`date_valid_from`) REFERENCES `price_table_groups`(`date_valid_from`) 
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 4: timetable_dates - Drop duplicate regular index (UNIQUE already exists)
ALTER TABLE `timetable_dates` DROP INDEX `idx_date_valid_from`;
