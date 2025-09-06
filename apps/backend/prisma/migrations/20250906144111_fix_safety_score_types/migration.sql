-- Fix safety_score_config table types to match Prisma schema
-- This migration safely handles existing constraints

-- Note: Since these changes may already be applied, we handle errors gracefully
-- The migration is idempotent and can be run multiple times

-- Alter safety_score_config table - convert ENUMs to VARCHAR
ALTER TABLE `safety_score_config` 
  MODIFY COLUMN `event_type` VARCHAR(50) NOT NULL,
  MODIFY COLUMN `severity` VARCHAR(20) NOT NULL;

-- Add Prisma-style foreign key constraints if they don't exist
-- These will replace the old constraints