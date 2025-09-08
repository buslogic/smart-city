import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTables() {
  try {
    const tables = await prisma.$queryRaw<{Tables_in_smartcity: string}[]>`
      SHOW TABLES LIKE 'gps%'
    `;
    
    console.log('GPS tabele u bazi:');
    tables.forEach(t => console.log(`- ${t.Tables_in_smartcity}`));
    
    // Proveri da li postoji gps_batch_history
    const batchHistoryExists = tables.some(t => t.Tables_in_smartcity === 'gps_batch_history');
    console.log(`\ngps_batch_history postojeća: ${batchHistoryExists ? 'DA' : 'NE'}`);
    
  } catch (error) {
    console.error('Greška:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();