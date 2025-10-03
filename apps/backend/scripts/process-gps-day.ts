import { Client } from 'pg';

// Čitaj parametre iz command line
const args = process.argv.slice(2);
const dateArg = args[0]; // Format: YYYY-MM-DD
const maxParallel = parseInt(args[1]) || 100;

if (!dateArg) {
  console.error('❌ Greška: Morate specificirati datum!');
  console.error('   Usage: npm run gps:process:day YYYY-MM-DD [MAX_PARALLEL]');
  console.error('   Example: npm run gps:process:day 2025-09-01 100');
  process.exit(1);
}

// Validiraj datum format
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRegex.test(dateArg)) {
  console.error('❌ Greška: Neispravan format datuma! Koristite YYYY-MM-DD');
  process.exit(1);
}

// Kreiraj UTC datume za ceo dan (00:00:00 - 23:59:59 UTC)
const START_DATE = `${dateArg}T00:00:00Z`;
const nextDay = new Date(dateArg);
nextDay.setUTCDate(nextDay.getUTCDate() + 1);
const END_DATE = nextDay.toISOString().split('T')[0] + 'T00:00:00Z';

interface VehicleToProcess {
  vehicle_id: number;
  garage_no: string;
  estimated_rows: string;
}

async function getClient(): Promise<Client> {
  const client = new Client({
    connectionString:
      process.env.TIMESCALE_DATABASE_URL ||
      'postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps?sslmode=disable',
  });
  await client.connect();
  return client;
}

async function findVehiclesToProcess(
  startTime: Date,
  endTime: Date,
  limit: number = 100
): Promise<VehicleToProcess[]> {
  const client = await getClient();

  try {
    const result = await client.query<VehicleToProcess>(
      `SELECT * FROM find_next_vehicles_to_process($1, $2, $3)`,
      [startTime, endTime, limit]
    );

    return result.rows;
  } finally {
    await client.end();
  }
}

async function processVehiclesParallel(
  startTime: Date,
  endTime: Date,
  vehicleIds: number[],
  maxParallel: number = 100
) {
  const client = await getClient();

  try {
    console.log(`🚀 Parallel processing: ${startTime.toISOString()} - ${endTime.toISOString()}`);
    console.log(`   Max parallel vozila: ${maxParallel}`);

    const result = await client.query(
      `SELECT * FROM process_vehicles_parallel($1, $2, $3, $4)`,
      [startTime, endTime, vehicleIds, maxParallel]
    );

    console.log(`\n✅ Parallel processing završen - ${result.rows.length} vozila:`);
    result.rows.forEach((row: any) => {
      const icon = row.status === 'completed' ? '✅' : '❌';
      console.log(`   ${icon} Vozilo ${row.vehicle_id}: ${row.rows_processed} redova, ${row.outliers_detected} outlier-a (${row.status})`);
    });

    return result.rows;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log(`🚀 GPS Batch Processor - ${dateArg}`);
  console.log(`   Period (UTC): ${START_DATE} - ${END_DATE}`);
  console.log(`   Max parallel: ${maxParallel} vozila`);
  console.log('');

  const startTime = new Date(START_DATE);
  const endTime = new Date(END_DATE);

  // Procesiranje po satima (24 iteracije za ceo dan)
  let currentStart = new Date(startTime);
  let hour = 0;
  let totalProcessed = 0;
  let totalOutliers = 0;

  while (currentStart < endTime) {
    const currentEnd = new Date(currentStart);
    currentEnd.setUTCHours(currentEnd.getUTCHours() + 1);

    hour++;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📅 Sat ${hour}/24: ${currentStart.toISOString()} - ${currentEnd.toISOString()}`);
    console.log('='.repeat(80));

    // Pronađi vozila
    const vehicles = await findVehiclesToProcess(currentStart, currentEnd, maxParallel);

    if (vehicles.length === 0) {
      console.log('ℹ️  Nema vozila za procesiranje u ovom periodu');
      currentStart = currentEnd;
      continue;
    }

    console.log(`\n📋 Pronađeno ${vehicles.length} vozila za procesiranje:`);
    const totalRows = vehicles.reduce((sum, v) => sum + parseInt(v.estimated_rows), 0);
    console.log(`   Ukupno redova: ${totalRows.toLocaleString()}`);

    // Procesiranje
    const vehicleIds = vehicles.map((v) => v.vehicle_id);
    const results = await processVehiclesParallel(currentStart, currentEnd, vehicleIds, maxParallel);

    // Saberi rezultate
    results.forEach((r: any) => {
      totalProcessed += r.rows_processed || 0;
      totalOutliers += r.outliers_detected || 0;
    });

    // Pauza između batch-eva
    await new Promise(resolve => setTimeout(resolve, 2000));

    currentStart = currentEnd;
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ Procesiranje datuma ${dateArg} kompletno!`);
  console.log(`   Ukupno procesiranih redova: ${totalProcessed.toLocaleString()}`);
  console.log(`   Ukupno outlier-a: ${totalOutliers.toLocaleString()}`);
  console.log(`   Outlier procenat: ${totalProcessed > 0 ? ((totalOutliers / totalProcessed) * 100).toFixed(2) : 0}%`);
  console.log('='.repeat(80));
}

main().catch((err) => {
  console.error('❌ Greška:', err);
  process.exit(1);
});
