import { Client } from 'pg';

// Čitaj parametre iz command line
const args = process.argv.slice(2);
const startDateArg = args[0]; // Format: YYYY-MM-DD
const endDateArg = args[1]; // Format: YYYY-MM-DD
const maxParallel = parseInt(args[2]) || 100;

if (!startDateArg || !endDateArg) {
  console.error('❌ Greška: Morate specificirati start i end datum!');
  console.error('   Usage: npm run gps:process:range START_DATE END_DATE [MAX_PARALLEL]');
  console.error('   Example: npm run gps:process:range 2025-09-01 2025-09-30 100');
  process.exit(1);
}

// Validiraj datum format
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRegex.test(startDateArg) || !dateRegex.test(endDateArg)) {
  console.error('❌ Greška: Neispravan format datuma! Koristite YYYY-MM-DD');
  process.exit(1);
}

// Kreiraj UTC datume
const START_DATE = `${startDateArg}T00:00:00Z`;
const nextDay = new Date(endDateArg);
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
    const result = await client.query(
      `SELECT * FROM process_vehicles_parallel($1, $2, $3, $4)`,
      [startTime, endTime, vehicleIds, maxParallel]
    );

    return result.rows;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log(`🚀 GPS Batch Processor - Range Processing`);
  console.log(`   Period (UTC): ${START_DATE} - ${END_DATE}`);
  console.log(`   Max parallel: ${maxParallel} vozila`);
  console.log('');

  const startTime = new Date(START_DATE);
  const endTime = new Date(END_DATE);

  // Calculate total days
  const totalDays = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`📅 Ukupno dana za procesiranje: ${totalDays}`);
  console.log('');

  // Procesiranje po danima (24-satni blokovi)
  let currentStart = new Date(startTime);
  let dayNumber = 0;
  let grandTotalProcessed = 0;
  let grandTotalOutliers = 0;

  while (currentStart < endTime) {
    dayNumber++;
    const dayStart = new Date(currentStart);
    const dayEnd = new Date(currentStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    // Don't go past the end date
    if (dayEnd > endTime) {
      dayEnd.setTime(endTime.getTime());
    }

    console.log(`\n${'█'.repeat(80)}`);
    console.log(`📅 DAN ${dayNumber}/${totalDays}: ${dayStart.toISOString().split('T')[0]}`);
    console.log('█'.repeat(80));

    let dayTotalProcessed = 0;
    let dayTotalOutliers = 0;
    let hour = 0;

    // Process this day hour by hour
    let hourStart = new Date(dayStart);
    while (hourStart < dayEnd) {
      const hourEnd = new Date(hourStart);
      hourEnd.setUTCHours(hourEnd.getUTCHours() + 1);

      // Don't go past day end
      if (hourEnd > dayEnd) {
        hourEnd.setTime(dayEnd.getTime());
      }

      hour++;
      console.log(`\n  📍 Sat ${hour}: ${hourStart.toISOString()} - ${hourEnd.toISOString()}`);

      // Find vehicles
      const vehicles = await findVehiclesToProcess(hourStart, hourEnd, maxParallel);

      if (vehicles.length === 0) {
        console.log('     ℹ️  Nema vozila za procesiranje');
        hourStart = hourEnd;
        continue;
      }

      const totalRows = vehicles.reduce((sum, v) => sum + parseInt(v.estimated_rows), 0);
      console.log(`     📋 ${vehicles.length} vozila, ${totalRows.toLocaleString()} redova`);

      // Process
      const vehicleIds = vehicles.map((v) => v.vehicle_id);
      const results = await processVehiclesParallel(hourStart, hourEnd, vehicleIds, maxParallel);

      // Count results
      let hourProcessed = 0;
      let hourOutliers = 0;
      results.forEach((r: any) => {
        hourProcessed += r.rows_processed || 0;
        hourOutliers += r.outliers_detected || 0;
      });

      dayTotalProcessed += hourProcessed;
      dayTotalOutliers += hourOutliers;

      console.log(`     ✅ Procesiranu: ${hourProcessed} redova, ${hourOutliers} outlier-a`);

      // Small pause between hours
      await new Promise(resolve => setTimeout(resolve, 1000));

      hourStart = hourEnd;
    }

    grandTotalProcessed += dayTotalProcessed;
    grandTotalOutliers += dayTotalOutliers;

    console.log(`\n  📊 Dan ${dayNumber} - Ukupno:`);
    console.log(`     Procesiranih redova: ${dayTotalProcessed.toLocaleString()}`);
    console.log(`     Outlier-a: ${dayTotalOutliers.toLocaleString()}`);
    console.log(`     Outlier procenat: ${dayTotalProcessed > 0 ? ((dayTotalOutliers / dayTotalProcessed) * 100).toFixed(2) : 0}%`);

    currentStart.setUTCDate(currentStart.getUTCDate() + 1);
  }

  console.log(`\n${'█'.repeat(80)}`);
  console.log(`✅ PROCESIRANJE KOMPLETNO!`);
  console.log(`   Period: ${startDateArg} - ${endDateArg}`);
  console.log(`   Ukupno dana: ${totalDays}`);
  console.log(`   Ukupno procesiranih redova: ${grandTotalProcessed.toLocaleString()}`);
  console.log(`   Ukupno outlier-a: ${grandTotalOutliers.toLocaleString()}`);
  console.log(`   Outlier procenat: ${grandTotalProcessed > 0 ? ((grandTotalOutliers / grandTotalProcessed) * 100).toFixed(2) : 0}%`);
  console.log('█'.repeat(80));
}

main().catch((err) => {
  console.error('❌ Greška:', err);
  process.exit(1);
});
