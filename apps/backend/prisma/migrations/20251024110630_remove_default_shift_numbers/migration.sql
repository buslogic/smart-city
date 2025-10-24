-- AlterTable: Uklanjanje default vrednosti sa shift_number kolona
-- Razlog: Default vrednosti nisu potrebne, aplikacija uvek eksplicitno prosleđuje vrednosti
ALTER TABLE `turnus_linked`
  ALTER COLUMN `shift_number_1` DROP DEFAULT,
  ALTER COLUMN `shift_number_2` DROP DEFAULT;
