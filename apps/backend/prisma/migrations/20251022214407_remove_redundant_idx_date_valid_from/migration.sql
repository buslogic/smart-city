-- Remove redundant idx_date_valid_from index from price_table_groups table
--
-- Problem: Migration 20251008105035 created the table with idx_date_valid_from index
--          Migration 20251008130947 added UNIQUE constraint unique_date_valid_from
--          But it didn't remove the old index, causing redundancy
--
-- UNIQUE constraint automatically creates an index, so idx_date_valid_from is unnecessary
-- This causes schema drift detection in GitHub Actions validation
--
-- Solution: Drop the redundant index
--
-- Note: This index may not exist in all databases:
-- - Fresh GitHub Actions test databases WILL have this index (created by migration 105035)
-- - Some existing databases may have already removed it manually
-- - If this migration fails locally with error 1091 ("Can't DROP index"),
--   mark it as resolved with: npx prisma migrate resolve --applied 20251022214407_remove_redundant_idx_date_valid_from

DROP INDEX `idx_date_valid_from` ON `price_table_groups`;
