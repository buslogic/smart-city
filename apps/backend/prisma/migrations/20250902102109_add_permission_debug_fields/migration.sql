-- AlterTable
ALTER TABLE `permissions` ADD COLUMN `category` VARCHAR(50) NULL,
    ADD COLUMN `description_sr` TEXT NULL,
    ADD COLUMN `required_for` TEXT NULL,
    ADD COLUMN `ui_route` VARCHAR(255) NULL;

-- CreateIndex
CREATE INDEX `permissions_category_idx` ON `permissions`(`category`);

-- CreateIndex
CREATE INDEX `permissions_ui_route_idx` ON `permissions`(`ui_route`);
