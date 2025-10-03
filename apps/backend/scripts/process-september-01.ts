import { Client } from 'pg';

const MAX_PARALLEL = 100;
// UTC vremenska zona - eksplicitno koristimo 'Z' suffix da bi se parsirale kao UTC
const START_DATE = '2025-09-01T00:00:00Z'; // 1. septembar 00:00 UTC
const END_DATE = '2025-09-02T00:00:00Z'; // 2. septembar 00:00 UTC (pokriva ceo 1. septembar)

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
  console.log('🚀 GPS Batch Processor - 1. Septembar 2025');
  console.log(`   Period: ${START_DATE} - ${END_DATE}`);
  console.log(`   Max parallel: ${MAX_PARALLEL} vozila`);
  console.log('');

  const startTime = new Date(START_DATE);
  const endTime = new Date(END_DATE);

  // Procesiranje po satima (24 iteracije)
  let currentStart = new Date(startTime);
  let hour = 0;

  while (currentStart < endTime) {
    const currentEnd = new Date(currentStart);
    currentEnd.setHours(currentEnd.getHours() + 1);

    hour++;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📅 Sat ${hour}/24: ${currentStart.toISOString()} - ${currentEnd.toISOString()}`);
    console.log('='.repeat(80));

    // Pronađi vozila
    const vehicles = await findVehiclesToProcess(currentStart, currentEnd, MAX_PARALLEL);

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
    await processVehiclesParallel(currentStart, currentEnd, vehicleIds, MAX_PARALLEL);

    // Pauza između batch-eva
    await new Promise(resolve => setTimeout(resolve, 2000));

    currentStart = currentEnd;
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ Procesiranje 1. septembra kompletno!');
  console.log('='.repeat(80));
}

main().catch((err) => {
  console.error('❌ Greška:', err);
  process.exit(1);
});
