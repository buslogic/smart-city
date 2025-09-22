-- Remove DEFAULT from updated_at column to match Prisma schema
-- Prisma @updatedAt manages this automatically, doesn't need DB default
ALTER TABLE `api_keys`
MODIFY COLUMN `updated_at` DATETIME(3) NOT NULL;