-- Kreiranje API Keys sistema za Smart City platformu (FINALNA VERZIJA)

-- CreateTable: API Keys
CREATE TABLE `api_keys` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `key_hash` VARCHAR(191) NOT NULL,
    `display_key` VARCHAR(10) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('SWAGGER_ACCESS', 'API_ACCESS', 'ADMIN_ACCESS', 'INTEGRATION') NOT NULL DEFAULT 'API_ACCESS',
    `permissions` JSON NULL,
    `allowed_ips` JSON NULL,
    `rate_limit` INTEGER NULL DEFAULT 1000,
    `expires_at` DATETIME(3) NULL,
    `last_used_at` DATETIME(3) NULL,
    `last_used_ip` VARCHAR(191) NULL,
    `usage_count` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `revoked_at` DATETIME(3) NULL,
    `revoked_by` INTEGER NULL,
    `revoke_reason` VARCHAR(191) NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `api_keys_key_key`(`key`),
    UNIQUE INDEX `api_keys_key_hash_key`(`key_hash`),
    INDEX `api_keys_is_active_idx`(`is_active`),
    INDEX `api_keys_type_idx`(`type`),
    INDEX `api_keys_expires_at_idx`(`expires_at`),
    INDEX `api_keys_created_by_idx`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: API Key Logs
CREATE TABLE `api_key_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `api_key_id` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` TEXT NULL,
    `endpoint` VARCHAR(500) NULL,
    `method` VARCHAR(10) NULL,
    `response_code` INTEGER NULL,
    `response_time` INTEGER NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `api_key_logs_api_key_id_idx`(`api_key_id`),
    INDEX `api_key_logs_action_idx`(`action`),
    INDEX `api_key_logs_created_at_idx`(`created_at`),
    INDEX `api_key_logs_ip_address_idx`(`ip_address`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: API Keys -> Users (creator)
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: API Keys -> Users (revoker)  
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_revoked_by_fkey` FOREIGN KEY (`revoked_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: API Key Logs -> API Keys
ALTER TABLE `api_key_logs` ADD CONSTRAINT `api_key_logs_api_key_id_fkey` FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;