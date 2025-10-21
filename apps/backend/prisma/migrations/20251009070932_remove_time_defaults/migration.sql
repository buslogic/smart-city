-- AlterTable: Remove DEFAULT values from TIME columns to fix Prisma drift detection
ALTER TABLE `lines`
  MODIFY `time_from_by_line` time NOT NULL,
  MODIFY `time_to_by_line` time NOT NULL;
