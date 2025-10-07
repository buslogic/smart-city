-- Add missing columns to vodovod_water_meter
ALTER TABLE `vodovod_water_meter`
ADD COLUMN `sifra_potrosaca` INT NULL AFTER `idmm`,
ADD COLUMN `sifra_kupca` INT NULL AFTER `sifra_potrosaca`;

-- Create indexes for new columns
CREATE INDEX `vodomer_fk_sifra_potrosaca` ON `vodovod_water_meter`(`sifra_potrosaca` ASC);
CREATE INDEX `vodomer_fk_sifra_kupca` ON `vodovod_water_meter`(`sifra_kupca` ASC);

-- Add missing columns to vodovod_replaced_water_meter
ALTER TABLE `vodovod_replaced_water_meter`
ADD COLUMN `sifra_potrosaca` INT NULL AFTER `idmm`,
ADD COLUMN `sifra_kupca` INT NULL AFTER `sifra_potrosaca`;

-- Add zs_printout column to vodovod_water_meter_readings
ALTER TABLE `vodovod_water_meter_readings`
ADD COLUMN `zs_printout` BOOLEAN NULL AFTER `census_select`;
