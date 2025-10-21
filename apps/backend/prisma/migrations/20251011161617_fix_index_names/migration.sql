-- RenameIndex - Fix index names to match Prisma naming convention
-- This fixes the schema drift detected by validation

-- Rename indexes FROM short names TO long names
ALTER TABLE `changes_codes_tours` RENAME INDEX `turnus_id` TO `changes_codes_tours_turnus_id_idx`;

ALTER TABLE `changes_codes_tours` RENAME INDEX `line_type_id` TO `changes_codes_tours_line_type_id_idx`;

ALTER TABLE `changes_codes_tours` RENAME INDEX `central_point` TO `changes_codes_tours_central_point_idx`;

ALTER TABLE `changes_codes_tours` RENAME INDEX `turnus_name` TO `changes_codes_tours_turnus_name_idx`;

ALTER TABLE `changes_codes_tours` RENAME INDEX `line_no` TO `changes_codes_tours_line_no_idx`;

ALTER TABLE `changes_codes_tours` RENAME INDEX `change_code` TO `changes_codes_tours_change_code_idx`;

ALTER TABLE `changes_codes_tours` RENAME INDEX `start_time` TO `changes_codes_tours_start_time_idx`;
