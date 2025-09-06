import { LegacySyncWorkerPoolService } from './legacy-sync-worker-pool.service';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testWorkerPool() {
  const garageNo = process.argv[2];
  if (!garageNo) {
    console.error('❌ Potreban je garažni broj vozila kao argument');
    console.error('Primer: npm run test:worker-pool P93572');
    process.exit(1);
  }

  console.log('🚀 Test Worker Pool importa za vozilo:', garageNo);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  
  const prisma = new PrismaClient();
  
  const workerPoolService = new LegacySyncWorkerPoolService(
    {
      error: console.error,
      log: console.log,
      warn: console.warn,
      debug: console.log
    } as any
  );
  
  // Dodeli prisma nakon kreiranja servisa
  (workerPoolService as any).prisma = prisma;

  try {
    // Pronađi vozilo
    const vehicle = await prisma.busVehicle.findFirst({
      where: { garageNumber: garageNo }
    });

    if (!vehicle) {
      console.error(`❌ Vozilo ${garageNo} nije pronađeno u bazi`);
      process.exit(1);
    }

    console.log(`✅ Pronađeno vozilo: ${vehicle.garageNumber} (ID: ${vehicle.id})`);

    // Pokreni Worker Pool sync sa jednim vozilom
    const result = await workerPoolService.startWorkerPoolSync(
      [vehicle.id],
      new Date('2025-09-05'), // startDate
      new Date(),  // endDate
      'test-job-123'  // jobId
    );
    
    console.log('📊 Rezultat importa:', result);
    
  } catch (error) {
    console.error('❌ Greška pri testu:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Pokreni test
testWorkerPool().catch(console.error);