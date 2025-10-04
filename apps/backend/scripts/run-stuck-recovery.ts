import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function recoverStuckRecords() {
  try {
    const stuckThresholdMinutes = 5;
    const maxRetries = 3;

    const stuckThreshold = new Date();
    stuckThreshold.setMinutes(
      stuckThreshold.getMinutes() - stuckThresholdMinutes,
    );

    console.log(`🔧 Tražim stuck zapise (starije od ${stuckThresholdMinutes} min)...\n`);

    // Dohvati stuck zapise
    const stuckRecords = await prisma.$queryRaw<
      { id: bigint; retry_count: number; vehicle_id: number }[]
    >`
      SELECT id, retry_count, vehicle_id
      FROM gps_raw_buffer
      WHERE process_status = 'processing'
      AND processed_at < ${stuckThreshold}
      LIMIT 10000
    `;

    if (stuckRecords.length === 0) {
      console.log('✅ Nema stuck zapisa!');
      return { recovered: 0, failed: 0 };
    }

    console.log(`📊 Pronađeno ${stuckRecords.length} stuck zapisa\n`);

    // Podeli na one koje treba retry-ovati i one koje treba failovati
    const recordsToRetry: bigint[] = [];
    const recordsToFail: bigint[] = [];

    stuckRecords.forEach((record) => {
      if (record.retry_count >= maxRetries - 1) {
        recordsToFail.push(record.id);
      } else {
        recordsToRetry.push(record.id);
      }
    });

    console.log(`📋 Plan:`);
    console.log(`   - ${recordsToRetry.length} zapisa → reset u pending (retry)`);
    console.log(`   - ${recordsToFail.length} zapisa → označi kao failed (max retries)\n`);

    let recoveredCount = 0;
    let failedCount = 0;

    // Reset zapisa za retry
    if (recordsToRetry.length > 0) {
      console.log(`🔄 Resetujem ${recordsToRetry.length} zapisa u pending...`);

      const result = await prisma.$executeRaw`
        UPDATE gps_raw_buffer
        SET process_status = 'pending',
            retry_count = retry_count + 1,
            processed_at = NULL,
            error_message = CONCAT(
              COALESCE(error_message, ''),
              ' | Auto-recovery: Reset from stuck processing status at ',
              NOW()
            )
        WHERE id IN (${Prisma.join(recordsToRetry)})
      `;
      recoveredCount = result;
      console.log(`   ✅ ${recoveredCount} zapisa resetovano\n`);
    }

    // Označi kao trajno failed
    if (recordsToFail.length > 0) {
      console.log(`⚠️  Označavam ${recordsToFail.length} zapisa kao failed...`);

      const result = await prisma.$executeRaw`
        UPDATE gps_raw_buffer
        SET process_status = 'failed',
            retry_count = retry_count + 1,
            error_message = CONCAT(
              COALESCE(error_message, ''),
              ' | Auto-recovery: Max retries exceeded, marked as failed at ',
              NOW()
            )
        WHERE id IN (${Prisma.join(recordsToFail)})
      `;
      failedCount = result;
      console.log(`   ✅ ${failedCount} zapisa označeno kao failed\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Recovery završen!`);
    console.log(`   Recovered: ${recoveredCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return { recovered: recoveredCount, failed: failedCount };
  } catch (error) {
    console.error('❌ Greška pri recovery-ju:', error);
    return { recovered: 0, failed: 0 };
  }
}

async function main() {
  const result = await recoverStuckRecords();

  // Proveri novo stanje
  console.log('📊 Novo stanje buffer-a:\n');

  const statuses = await prisma.$queryRaw<
    { process_status: string; count: bigint }[]
  >`
    SELECT process_status, COUNT(*) as count
    FROM gps_raw_buffer
    GROUP BY process_status
    ORDER BY process_status
  `;

  statuses.forEach((s) => {
    console.log(`   ${s.process_status}: ${s.count}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Greška:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
