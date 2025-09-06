import { LegacySyncWorkerPoolService } from './legacy-sync-worker-pool.service';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testMultipleVehicles() {
  const garageNumbers = process.argv.slice(2);
  if (garageNumbers.length === 0) {
    console.error('❌ Potrebni su garažni brojevi vozila kao argumenti');
    console.error('Primer: npm run test:worker-pool P93572 P93573 P93574');
    process.exit(1);
  }

  console.log('🚀 Test Worker Pool importa za vozila:', garageNumbers.join(', '));
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
    // Pronađi sva vozila
    const vehicles = await prisma.busVehicle.findMany({
      where: { 
        garageNumber: { in: garageNumbers }
      }
    });

    if (vehicles.length === 0) {
      console.error(`❌ Nijedno vozilo nije pronađeno u bazi`);
      process.exit(1);
    }

    console.log(`✅ Pronađeno ${vehicles.length} vozila:`);
    vehicles.forEach(v => console.log(`   - ${v.garageNumber} (ID: ${v.id})`));

    const vehicleIds = vehicles.map(v => v.id);

    // Pokreni Worker Pool sync sa svim vozilima
    console.log(`\n🏁 Pokrećem Worker Pool sa ${vehicleIds.length} vozila...`);
    const startTime = Date.now();
    
    const result = await workerPoolService.startWorkerPoolSync(
      vehicleIds,
      new Date('2025-09-05'), // startDate
      new Date(),  // endDate
      'test-multi-' + Date.now()  // jobId
    );
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n📊 REZULTATI IMPORTA:');
    console.log('='.repeat(50));
    
    let totalProcessed = 0;
    let totalRecords = 0;
    
    result.forEach((workerResult, vehicleId) => {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      console.log(`\n📍 ${vehicle?.garageNumber || vehicleId}:`);
      console.log(`   Status: ${workerResult.status}`);
      console.log(`   Procesirano: ${workerResult.processedRecords.toLocaleString()} GPS tačaka`);
      console.log(`   Trajanje: ${(workerResult.duration / 1000).toFixed(1)}s`);
      console.log(`   Worker ID: ${workerResult.workerId}`);
      
      totalProcessed += workerResult.processedRecords;
      totalRecords += workerResult.totalRecords;
    });
    
    console.log('\n' + '='.repeat(50));
    console.log(`✅ UKUPNO:`);
    console.log(`   Vozila: ${result.size}`);
    console.log(`   GPS tačaka: ${totalProcessed.toLocaleString()}`);
    console.log(`   Vreme: ${duration.toFixed(1)}s`);
    console.log(`   Brzina: ${(totalProcessed / duration).toFixed(0)} tačaka/sekund`);
    
  } catch (error) {
    console.error('❌ Greška pri testu:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Pokreni test
testMultipleVehicles().catch(console.error);