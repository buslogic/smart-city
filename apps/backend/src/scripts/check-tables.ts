import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTables() {
  try {
    const tables = await prisma.$queryRaw`
      SHOW TABLES LIKE 'user_dashboard%'
    `;
    console.log('Dashboard tables:', tables);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();