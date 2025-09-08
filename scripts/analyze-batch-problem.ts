import { PrismaClient } from '../apps/backend/node_modules/@prisma/client';

const prisma = new PrismaClient();

async function analyzeBatchProblem() {
  console.log('=====================================');
  console.log('BATCH DURATION PROBLEM ANALYSIS');
  console.log('=====================================\n');

  try {
    // Pronađi batch-eve sa problematičnim trajanjem
    const batches = await prisma.gpsBatchHistory.findMany({
      orderBy: { batchNumber: 'desc' },
      take: 20,
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

    console.log('🔍 ANALIZA PROBLEMA SA TRAJANJEM:\n');
    
    let problemBatches = 0;
    
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
        const avgDuration = sumDuration / workerDurations.length;
        
        // Proveri da li je problem
        const tolerance = 100; // 100ms tolerancija
        const hasRealTimeProblem = Math.abs(storedDuration - realDuration) > tolerance;
        const hasSumProblem = Math.abs(storedDuration - sumDuration) < tolerance;
        const hasMaxProblem = Math.abs(storedDuration - maxDuration) < tolerance;
        
        if (hasRealTimeProblem || hasSumProblem) {
          problemBatches++;
          console.log(`❌ PROBLEMATIČAN Batch #${batch.batchNumber}:`);
          console.log(`   Početak: ${batch.startedAt.toISOString()}`);
          console.log(`   Kraj: ${batch.completedAt.toISOString()}`);
          console.log(`   Stvarno trajanje: ${realDuration}ms (${(realDuration/1000).toFixed(1)}s)`);
          console.log(`   Sačuvano trajanje: ${storedDuration}ms (${(storedDuration/1000).toFixed(1)}s)`);
          console.log(`   Razlika sa stvarnim: ${storedDuration - realDuration}ms`);
          console.log(`   Worker-i: ${batch.workerCount}`);
          console.log(`   Zbir worker trajanja: ${sumDuration}ms`);
          console.log(`   Max worker trajanje: ${maxDuration}ms`);
          console.log(`   Avg worker trajanje: ${avgDuration.toFixed(0)}ms`);
          console.log(`   Procesirano zapisa: ${batch.actualProcessed}`);
          
          if (hasSumProblem && !hasMaxProblem) {
            console.log(`   ⚠️ DIJAGNOZA: Čuva se ZBIR umesto MAX trajanja!`);
          } else if (hasRealTimeProblem) {
            console.log(`   ⚠️ DIJAGNOZA: Neusklađeno sa wall-clock vremenom!`);
          }
          
          // Prikaži detalje worker-a
          console.log(`   Worker detalji:`);
          workers.forEach((w: any, idx: number) => {
            if (w.duration) {
              console.log(`     Worker ${w.workerId}: ${w.duration}ms, processed: ${w.processed || 'N/A'}`);
            }
          });
          console.log('');
        }
      }
    });
    
    console.log('=====================================');
    console.log(`SUMARNO: ${problemBatches} problematičnih batch-eva od ${batches.length} analiziranih`);
    console.log('=====================================\n');
    
    // Dodatna analiza: Proveri da li worker logovi odgovaraju
    console.log('📊 PROVERA WORKER LOGOVA:\n');
    
    for (const batch of batches.slice(0, 3)) {
      if (batch.workerDetails) {
        const workers = batch.workerDetails as any[];
        console.log(`Batch #${batch.batchNumber}:`);
        
        // Za svaki worker iz batch detalja, pronađi odgovarajući log
        for (const worker of workers) {
          if (worker.workerId) {
            const workerLog = await prisma.gpsWorkerLog.findFirst({
              where: {
                batchId: batch.id,
                workerId: worker.workerId
              },
              select: {
                durationMs: true,
                recordsProcessed: true,
                recordsFailed: true
              }
            });
            
            if (workerLog) {
              const match = workerLog.durationMs === worker.duration;
              console.log(`  Worker ${worker.workerId}: Batch(${worker.duration}ms) vs Log(${workerLog.durationMs}ms) - ${match ? '✅ OK' : '❌ NEUSKLAĐENO'}`);
            } else {
              console.log(`  Worker ${worker.workerId}: Log nije pronađen`);
            }
          }
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeBatchProblem().catch(console.error);