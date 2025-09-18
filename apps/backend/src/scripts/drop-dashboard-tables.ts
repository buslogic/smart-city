import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function dropTables() {
  try {
    await prisma.$executeRawUnsafe(
      'DROP TABLE IF EXISTS user_dashboard_widgets',
    );
    console.log('Dropped user_dashboard_widgets table');

    await prisma.$executeRawUnsafe(
      'DROP TABLE IF EXISTS user_dashboard_configs',
    );
    console.log('Dropped user_dashboard_configs table');

    console.log('Tables dropped successfully');
  } catch (error) {
    console.error('Error dropping tables:', error);
  } finally {
    await prisma.$disconnect();
  }
}

dropTables();
