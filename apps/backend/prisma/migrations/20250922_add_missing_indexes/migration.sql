-- Add missing indexes for api_keys
CREATE INDEX `api_keys_revoked_by_idx` ON `api_keys`(`revoked_by`);

-- Add missing indexes for email_templates
CREATE INDEX `email_templates_created_by_idx` ON `email_templates`(`created_by`);
CREATE INDEX `email_templates_updated_by_idx` ON `email_templates`(`updated_by`);