-- AddMenuOrderToPermissions
-- Dodavanje menu_order kolone u permissions tabelu za hijerarhijsko sortiranje

-- Dodaj menu_order kolonu kao BigInt (BIGINT u MySQL) sa default NULL
ALTER TABLE `permissions` ADD COLUMN `menu_order` BIGINT NULL;

-- Dodaj indeks na menu_order kolonu za brže sortiranje
CREATE INDEX `permissions_menu_order_idx` ON `permissions`(`menu_order`);