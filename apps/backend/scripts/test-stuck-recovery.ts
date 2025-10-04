import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Provera stuck processing zapisa...\n');

  const stuckThresholdMinutes = 5;
  const stuckThreshold = new Date();
  stuckThreshold.setMinutes(
    stuckThreshold.getMinutes() - stuckThresholdMinutes,
  );

  // Ukupno stuck zapisa
  const totalStuck = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM gps_raw_buffer
    WHERE process_status = 'processing'
    AND processed_at < ${stuckThreshold}
  `;

  console.log(`📊 Ukupno stuck zapisa (>${stuckThresholdMinutes} min): ${totalStuck[0]?.count || 0}`);

  // Po worker grupama
  const byGroup = await prisma.$queryRaw<
    { worker_group: number; count: bigint; oldest: Date }[]
  >`
    SELECT
      worker_group,
      COUNT(*) as count,
      MIN(processed_at) as oldest
    FROM gps_raw_buffer
    WHERE process_status = 'processing'
    AND processed_at < ${stuckThreshold}
    GROUP BY worker_group
    ORDER BY worker_group
  `;

  console.log('\n📈 Po worker grupama:');
  byGroup.forEach((g) => {
    const hoursStuck = Math.floor(
      (new Date().getTime() - new Date(g.oldest).getTime()) / (1000 * 60 * 60),
    );
    console.log(
      `   Worker group ${g.worker_group}: ${g.count} stuck (najstariji: ${hoursStuck}h)`,
    );
  });

  // Proveri retry count distribuciju
  const retryDist = await prisma.$queryRaw<
    { retry_count: number; count: bigint }[]
  >`
    SELECT retry_count, COUNT(*) as count
    FROM gps_raw_buffer
    WHERE process_status = 'processing'
    AND processed_at < ${stuckThreshold}
    GROUP BY retry_count
    ORDER BY retry_count
  `;

  console.log('\n🔄 Retry count distribucija:');
  retryDist.forEach((r) => {
    console.log(`   Retry ${r.retry_count}: ${r.count} zapisa`);
  });

  console.log('\n🔧 Želite li pokrenuti recovery? (y/n)');
  console.log('   - Zapisi sa retry_count < 2 → reset u pending');
  console.log('   - Zapisi sa retry_count >= 2 → označi kao failed');
}

main()
  .catch((e) => {
    console.error('❌ Greška:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
