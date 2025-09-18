import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMigrations() {
  try {
    // Remove failed migration record
    await prisma.$executeRawUnsafe(`
      DELETE FROM _prisma_migrations 
      WHERE migration_name = '20250906142837_add_dashboard_tables'
    `);
    console.log('Removed failed migration record');

    console.log('Migration history cleaned');
  } catch (error) {
    console.error('Error fixing migrations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMigrations();
