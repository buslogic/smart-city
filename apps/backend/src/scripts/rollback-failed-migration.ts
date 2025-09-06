import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function rollbackFailed() {
  try {
    // Remove failed migration records
    await prisma.$executeRawUnsafe(`
      DELETE FROM _prisma_migrations 
      WHERE migration_name IN ('20250906143938_add_user_dashboard_widget', '20250906144111_fix_safety_score_types')
      AND (finished_at IS NULL OR applied_steps_count = 0)
    `);
    console.log('Removed failed migration records');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

rollbackFailed();