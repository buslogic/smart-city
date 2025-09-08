import { PrismaClient } from '../apps/backend/node_modules/@prisma/client';

const prisma = new PrismaClient();

async function analyzeBatchDuration() {
  console.log('=====================================');
  console.log('BATCH DURATION ANALYSIS');
  console.log('=====================================\n');

  try {
    // Poslednji batch-evi
    const batches = await prisma.gpsBatchHistory.findMany({
      take: 5,
      orderBy: { batchNumber: 'desc' },
      select: {
        batchNumber: true,
        startedAt: true,
        completedAt: true,
        totalDurationMs: true,
        workerCount: true,
        workerDetails: true
      }
    });

    console.log('📊 POSLEDNJI BATCH-EVI:\n');
    
    batches.forEach((batch: any) => {
      if (batch.completedAt) {
        const realDuration = batch.completedAt.getTime() - batch.startedAt.getTime();
        const storedDuration = batch.totalDurationMs || 0;
        
        console.log(`Batch #${batch.batchNumber}:`);
        console.log(`  Početak: ${batch.startedAt.toISOString()}`);
        console.log(`  Kraj: ${batch.completedAt.toISOString()}`);
        console.log(`  Stvarno trajanje: ${realDuration}ms (${(realDuration/1000).toFixed(1)}s)`);
        console.log(`  Sačuvano trajanje: ${storedDuration}ms (${(storedDuration/1000).toFixed(1)}s)`);
        console.log(`  Razlika: ${storedDuration - realDuration}ms`);
        
        // Analiza worker detalja
        if (batch.workerDetails) {
          const workers = batch.workerDetails as any[];
          const workerDurations = workers.map(w => w.duration || 0);
          const sumDuration = workerDurations.reduce((sum, d) => sum + d, 0);
          const maxDuration = Math.max(...workerDurations);
          
          console.log(`  Worker-i: ${batch.workerCount}`);
          console.log(`  Zbir worker trajanja: ${sumDuration}ms`);
          console.log(`  Max worker trajanje: ${maxDuration}ms`);
          console.log(`  Problem: ${storedDuration === sumDuration ? '❌ Čuva se ZBIR umesto MAX!' : '✅ OK'}`);
        }
        
        console.log('');
      }
    });

    // Proveri worker logove
    const workerLogs = await prisma.gpsWorkerLog.findMany({
      take: 10,
      orderBy: { startedAt: 'desc' },
      select: {
        batchId: true,
        workerId: true,
        startedAt: true,
        completedAt: true,
        durationMs: true
      }
    });

    console.log('\n📊 WORKER LOGOVI:');
    console.table(workerLogs.map((log: any) => ({
      batchId: log.batchId.substring(0, 8) + '...',
      worker: log.workerId,
      startedAt: log.startedAt.toISOString().split('T')[1],
      duration: `${log.durationMs}ms`
    })));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeBatchDuration().catch(console.error);