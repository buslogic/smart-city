-- AlterTable: Ukloni automatski generisane defaultove sa LONGTEXT kolona
-- MySQL automatski dodaje (_utf8mb4'') ali to nije kompatibilno sa Prisma
ALTER TABLE `lines`
  MODIFY `change_log` longtext NOT NULL,
  MODIFY `line_route` longtext NOT NULL,
  MODIFY `line_route1` longtext NOT NULL,
  MODIFY `g_line_route` longtext NOT NULL,
  MODIFY `g_line_route1` longtext NOT NULL;
