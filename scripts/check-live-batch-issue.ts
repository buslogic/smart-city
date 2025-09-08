import { PrismaClient } from '../apps/backend/node_modules/@prisma/client';

const prisma = new PrismaClient();

async function checkLiveBatchIssue() {
  console.log('=====================================');
  console.log('LIVE SERVER BATCH ISSUE CHECK');
  console.log('=====================================\n');

  try {
    // Uzmi poslednje batch-eve
    const batches = await prisma.gpsBatchHistory.findMany({
      orderBy: { batchNumber: 'desc' },
      take: 10,
      select: {
        id: true,
        batchNumber: true,
        startedAt: true,
        completedAt: true,
        totalDurationMs: true,
        workerCount: true,
        workerDetails: true,
        actualProcessed: true
      }
    });

    console.log('🔍 ANALIZA POSLEDNIH 10 BATCH-EVA:\n');
    
    batches.forEach((batch: any) => {
      if (batch.completedAt && batch.workerDetails) {
        const realDuration = batch.completedAt.getTime() - batch.startedAt.getTime();
        const storedDuration = batch.totalDurationMs || 0;
        
        // Analiza worker detalja
        const workers = batch.workerDetails as any[];
        const workerDurations = workers
          .filter((w: any) => w.duration)
          .map((w: any) => w.duration || 0);
        
        if (workerDurations.length === 0) return;
        
        const sumDuration = workerDurations.reduce((sum: number, d: number) => sum + d, 0);
        const maxDuration = Math.max(...workerDurations);
        
        // Proveri problem
        const realDurationSec = realDuration / 1000;
        const storedDurationSec = storedDuration / 1000;
        const sumDurationSec = sumDuration / 1000;
        const maxDurationSec = maxDuration / 1000;
        
        console.log(`Batch #${batch.batchNumber}:`);
        console.log(`  Početak: ${batch.startedAt.toISOString().split('T')[1].slice(0, 8)}`);
        console.log(`  Kraj: ${batch.completedAt.toISOString().split('T')[1].slice(0, 8)}`);
        console.log(`  Stvarno trajanje: ${realDurationSec.toFixed(1)}s`);
        console.log(`  Sačuvano u bazi (totalDurationMs): ${storedDurationSec.toFixed(1)}s`);
        console.log(`  Zbir svih worker-a: ${sumDurationSec.toFixed(1)}s`);
        console.log(`  Max worker trajanje: ${maxDurationSec.toFixed(1)}s`);
        console.log(`  Worker-i: ${batch.workerCount}`);
        console.log(`  Procesirano: ${batch.actualProcessed}`);
        
        // Dijagnoza problema
        const tolerance = 1; // 1 sekunda tolerancije
        if (Math.abs(storedDurationSec - sumDurationSec) < tolerance) {
          console.log(`  ❌ PROBLEM: Čuva se ZBIR worker trajanja umesto wall-clock vremena!`);
        } else if (Math.abs(storedDurationSec - realDurationSec) > tolerance) {
          console.log(`  ⚠️ PROBLEM: Sačuvano trajanje se ne poklapa sa stvarnim!`);
        } else {
          console.log(`  ✅ OK: Trajanje je ispravno sačuvano`);
        }
        
        console.log('');
      }
    });
    
    // Dodatna analiza: proveri da li postoji pattern
    console.log('=====================================');
    console.log('PATTERN ANALIZA:');
    console.log('=====================================\n');
    
    const problematicBatches = batches.filter((batch: any) => {
      if (!batch.completedAt || !batch.workerDetails) return false;
      
      const workers = batch.workerDetails as any[];
      const workerDurations = workers
        .filter((w: any) => w.duration)
        .map((w: any) => w.duration || 0);
      
      if (workerDurations.length === 0) return false;
      
      const sumDuration = workerDurations.reduce((sum: number, d: number) => sum + d, 0);
      const storedDuration = batch.totalDurationMs || 0;
      
      // Proveri da li je sačuvano trajanje blizu zbira
      return Math.abs(storedDuration - sumDuration) < 1000; // 1s tolerancija
    });
    
    if (problematicBatches.length > 0) {
      console.log(`⚠️ PRONAĐENO ${problematicBatches.length} od ${batches.length} batch-eva sa problemom!`);
      console.log(`   Verovatno stara verzija koda sabira worker trajanja.`);
      console.log(`   Preporučuje se deployment najnovije verzije.`);
    } else {
      console.log(`✅ Svi batch-evi koriste ispravnu kalkulaciju trajanja.`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLiveBatchIssue().catch(console.error);