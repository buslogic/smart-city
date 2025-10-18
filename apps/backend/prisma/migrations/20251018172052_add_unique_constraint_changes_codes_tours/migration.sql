-- CreateIndex
CREATE UNIQUE INDEX `changes_codes_tours_turnus_id_start_time_line_no_departure_n_key` ON `changes_codes_tours`(`turnus_id`, `start_time`, `line_no`, `departure_number`, `shift_number`);

