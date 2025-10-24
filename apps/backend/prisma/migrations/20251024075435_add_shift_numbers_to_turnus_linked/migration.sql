-- DropIndex: uklanjanje starog unique constraint-a
DROP INDEX `turnus_linked_line_number_1_turnus_id_1_line_number_2_turnus_key` ON `turnus_linked`;

-- AlterTable: dodavanje shift_number_1 i shift_number_2 kolona sa default vrednostima
-- VAŽNO: Postojeći linked turnusi će dobiti default shift=1
-- Potrebno je ažurirati ove zapise ručno nakon migracije
ALTER TABLE `turnus_linked`
  ADD COLUMN `shift_number_1` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN `shift_number_2` TINYINT UNSIGNED NOT NULL DEFAULT 1;

-- CreateIndex: novi unique constraint koji uključuje shift numbers
CREATE UNIQUE INDEX `turnus_linked_line_number_1_turnus_id_1_shift_number_1_line__key`
  ON `turnus_linked`(`line_number_1`, `turnus_id_1`, `shift_number_1`, `line_number_2`, `turnus_id_2`, `shift_number_2`);
