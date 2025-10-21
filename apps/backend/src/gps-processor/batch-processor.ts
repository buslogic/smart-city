/**
 * GPS Batch Processor
 *
 * Automatski procesira GPS podatke iz gps_data u gps_data_lag_filtered tabelu.
 * Koristi LAG() window funkciju za outlier detekciju.
 *
 * Može raditi u dva moda:
 * 1. Continuous mode - procesira nove podatke svakih X minuta
 * 2. Backfill mode - procesira istorijske podatke
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Client } from 'pg';
import * as cron from 'node-cron';
import { format, subHours, startOfHour, endOfHour } from 'date-fns';

interface BatchResult {
  batch_id: number;
  status: string;
  rows_processed: string; // bigint comes as string
  outliers_detected: string; // bigint comes as string
  duration_seconds: number;
}

interface ProcessingStatus {
  id: number;
  start_time: Date;
  end_time: Date;
  vehicle_id?: number;
  status: string;
  rows_processed?: string;
  rows_filtered?: string;
  error_message?: string;
}

interface ParallelBatchResult {
  vehicle_id: number;
  batch_id: number;
  rows_processed: string;
  outliers_detected: string;
  status: string;
  error_message: string | null;
}

interface VehicleToProcess {
  vehicle_id: number;
  garage_no: string;
  estimated_rows: string;
  last_processed_time: Date | null;
}

/**
 * Procesira jedan batch GPS podataka
 */
async function processBatch(
  startTime: Date,
  endTime: Date,
  vehicleId?: number
): Promise<BatchResult> {
  const client = new Client({
    connectionString: process.env.TIMESCALE_DATABASE_URL ||
      'postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps?sslmode=disable'
  });

  try {
    await client.connect();
    console.log(`📦 Procesiranje batch-a: ${startTime.toISOString()} - ${endTime.toISOString()}`);

    const query = vehicleId
      ? `SELECT * FROM process_gps_batch($1::timestamptz, $2::timestamptz, $3::integer)`
      : `SELECT * FROM process_gps_batch($1::timestamptz, $2::timestamptz, NULL::integer)`;

    const params = vehicleId ? [startTime, endTime, vehicleId] : [startTime, endTime];
    const result = await client.query<BatchResult>(query, params);

    if (result.rows.length > 0) {
      const batch = result.rows[0];
      console.log(`✅ Batch ${batch.batch_id} završen:`);
      console.log(`   - Status: ${batch.status}`);
      console.log(`   - Procesiranih redova: ${batch.rows_processed}`);
      console.log(`   - Detektovanih outlier-a: ${batch.outliers_detected}`);
      console.log(`   - Trajanje: ${batch.duration_seconds}s`);
      return batch;
    }

    throw new Error('Batch nije vratio rezultate');
  } catch (error) {
    console.error(`❌ Greška u procesiranju batch-a:`, error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Pronađi sledeći batch za procesiranje
 */
async function findNextBatch(): Promise<{ start_time: Date; end_time: Date; estimated_rows: string } | null> {
  const client = new Client({
    connectionString: process.env.TIMESCALE_DATABASE_URL ||
      'postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps?sslmode=disable'
  });

  try {
    await client.connect();
    const result = await client.query<any>('SELECT * FROM find_next_batch_to_process()');

    if (result.rows.length > 0 && parseInt(result.rows[0].estimated_rows) > 0) {
      return {
        start_time: result.rows[0].start_time,
        end_time: result.rows[0].end_time,
        estimated_rows: result.rows[0].estimated_rows
      };
    }

    return null;
  } catch (error) {
    console.error('Greška u pronalaženju sledećeg batch-a:', error);
    return null;
  } finally {
    await client.end();
  }
}

/**
 * Continuous processing - procesira nove podatke
 */
async function continuousProcess() {
  console.log('🔄 Pokretanje continuous processing-a...');

  try {
    // Pronađi sledeći batch
    const nextBatch = await findNextBatch();

    if (!nextBatch) {
      console.log('ℹ️ Nema novih podataka za procesiranje');
      return;
    }

    console.log(`📊 Pronađen batch sa ${nextBatch.estimated_rows} redova`);

    // Procesira batch
    await processBatch(nextBatch.start_time, nextBatch.end_time);

    // Rekurzivno pozovi za sledeći batch (do 10 batch-eva odjednom)
    let batchCount = 1;
    while (batchCount < 10) {
      const next = await findNextBatch();
      if (!next || parseInt(next.estimated_rows) === 0) break;

      await processBatch(next.start_time, next.end_time);
      batchCount++;
    }

    console.log(`✅ Procesiranih batch-eva: ${batchCount}`);
  } catch (error) {
    console.error('❌ Greška u continuous processing-u:', error);
  }
}

/**
 * Backfill processing - procesira istorijske podatke
 */
async function backfillProcess(
  startDate: Date,
  endDate: Date,
  hoursPerBatch: number = 1
) {
  console.log(`⏮️ Pokretanje backfill-a od ${startDate} do ${endDate}`);

  let currentStart = new Date(startDate);
  let processedBatches = 0;
  let failedBatches = 0;

  while (currentStart < endDate) {
    const currentEnd = new Date(Math.min(
      currentStart.getTime() + hoursPerBatch * 60 * 60 * 1000,
      endDate.getTime()
    ));

    try {
      await processBatch(currentStart, currentEnd);
      processedBatches++;
    } catch (error) {
      console.error(`❌ Batch failed za ${currentStart} - ${currentEnd}`);
      failedBatches++;
    }

    currentStart = currentEnd;

    // Pauza između batch-eva da ne preopteretimo bazu
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`✅ Backfill završen!`);
  console.log(`   - Uspešnih batch-eva: ${processedBatches}`);
  console.log(`   - Neuspešnih batch-eva: ${failedBatches}`);
}

/**
 * Retry failed batches
 */
async function retryFailedBatches(maxRetries: number = 3) {
  const client = new Client({
    connectionString: process.env.TIMESCALE_DATABASE_URL ||
      'postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps?sslmode=disable'
  });

  console.log(`🔄 Retry failed batch-eva (max ${maxRetries} pokušaja)...`);

  try {
    await client.connect();
    await client.query('SELECT retry_failed_batches($1::integer)', [maxRetries]);
    console.log('✅ Retry završen');
  } catch (error) {
    console.error('❌ Greška u retry-ju:', error);
  } finally {
    await client.end();
  }
}

/**
 * Status check
 */
async function checkStatus() {
  const client = new Client({
    connectionString: process.env.TIMESCALE_DATABASE_URL ||
      'postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps?sslmode=disable'
  });

  try {
    await client.connect();
    const result = await client.query('SELECT * FROM v_processing_status');

    if (result.rows.length > 0) {
      const s = result.rows[0];
      console.log('📊 Status procesiranja:');
      console.log(`   - Završenih batch-eva: ${s.completed_batches}`);
      console.log(`   - Neuspešnih batch-eva: ${s.failed_batches}`);
      console.log(`   - Aktivnih batch-eva: ${s.active_batches}`);
      console.log(`   - Čekajućih batch-eva: ${s.pending_batches}`);
      console.log(`   - Ukupno procesiranih redova: ${s.total_rows_processed || 0}`);
      console.log(`   - Ukupno outlier-a: ${s.total_outliers_found || 0}`);

      if (s.last_processed_time) {
        console.log(`   - Poslednje procesiran vreme: ${new Date(s.last_processed_time).toLocaleString()}`);
      }
      if (s.avg_processing_seconds) {
        console.log(`   - Prosečno vreme procesiranja: ${parseFloat(s.avg_processing_seconds).toFixed(2)}s`);
      }
    } else {
      console.log('ℹ️ Nema podataka o procesiranju');
    }
  } catch (error) {
    console.error('❌ Greška u proveri statusa:', error);
  } finally {
    await client.end();
  }
}

/**
 * Find vehicles to process for a given time period
 */
async function findVehiclesToProcess(
  startTime: Date,
  endTime: Date,
  limit: number = 5
): Promise<VehicleToProcess[]> {
  const client = new Client({
    connectionString: process.env.TIMESCALE_DATABASE_URL ||
      'postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps?sslmode=disable'
  });

  try {
    await client.connect();
    const result = await client.query<VehicleToProcess>(
      'SELECT * FROM find_next_vehicles_to_process($1::timestamptz, $2::timestamptz, $3::integer)',
      [startTime, endTime, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('Greška u pronalaženju vozila:', error);
    return [];
  } finally {
    await client.end();
  }
}

/**
 * Process multiple vehicles in parallel
 */
async function processVehiclesParallel(
  startTime: Date,
  endTime: Date,
  vehicleIds?: number[],
  maxParallel: number = 5
): Promise<ParallelBatchResult[]> {
  const client = new Client({
    connectionString: process.env.TIMESCALE_DATABASE_URL ||
      'postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps?sslmode=disable'
  });

  try {
    await client.connect();
    console.log(`🚀 Parallel processing: ${startTime.toISOString()} - ${endTime.toISOString()}`);
    console.log(`   Max parallel vozila: ${maxParallel}`);

    const query = vehicleIds
      ? `SELECT * FROM process_vehicles_parallel($1::timestamptz, $2::timestamptz, $3::integer[], $4::integer)`
      : `SELECT * FROM process_vehicles_parallel($1::timestamptz, $2::timestamptz, NULL::integer[], $3::integer)`;

    const params = vehicleIds
      ? [startTime, endTime, vehicleIds, maxParallel]
      : [startTime, endTime, maxParallel];

    const result = await client.query<ParallelBatchResult>(query, params);

    // Prikaz rezultata
    console.log(`\n✅ Parallel processing završen - ${result.rows.length} vozila:`);
    result.rows.forEach(r => {
      const status = r.status === 'completed' ? '✅' : r.status === 'failed' ? '❌' : '⏭️';
      console.log(`   ${status} Vozilo ${r.vehicle_id}: ${r.rows_processed} redova, ${r.outliers_detected} outlier-a (${r.status})`);
      if (r.error_message) {
        console.log(`      Greška: ${r.error_message}`);
      }
    });

    return result.rows;
  } catch (error) {
    console.error('❌ Greška u parallel processing-u:', error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Continuous parallel processing - procesira više vozila odjednom
 */
async function continuousParallelProcess(maxParallel: number = 5) {
  console.log(`🔄 Pokretanje continuous parallel processing-a (max ${maxParallel} vozila)...`);

  try {
    // Pronađi sledeći batch period
    const nextBatch = await findNextBatch();

    if (!nextBatch) {
      console.log('ℹ️ Nema novih podataka za procesiranje');
      return;
    }

    console.log(`📊 Pronađen period: ${nextBatch.start_time} - ${nextBatch.end_time}`);
    console.log(`   Ukupno redova: ${nextBatch.estimated_rows}`);

    // Pronađi vozila koja čekaju procesiranje
    const vehicles = await findVehiclesToProcess(
      nextBatch.start_time,
      nextBatch.end_time,
      maxParallel
    );

    if (vehicles.length === 0) {
      console.log('ℹ️ Nema vozila za procesiranje u ovom periodu');
      return;
    }

    console.log(`\n📋 Vozila za procesiranje (${vehicles.length}):`);
    vehicles.forEach(v => {
      console.log(`   - Vozilo ${v.vehicle_id} (${v.garage_no}): ${v.estimated_rows} redova`);
    });

    // Procesiranje u batch-evima po maxParallel vozila
    let processedVehicles = 0;
    while (processedVehicles < vehicles.length) {
      const batchVehicles = vehicles
        .slice(processedVehicles, processedVehicles + maxParallel)
        .map(v => v.vehicle_id);

      console.log(`\n🔄 Procesiranje batch-a vozila: ${batchVehicles.join(', ')}`);

      await processVehiclesParallel(
        nextBatch.start_time,
        nextBatch.end_time,
        batchVehicles,
        maxParallel
      );

      processedVehicles += batchVehicles.length;
    }

    console.log(`\n✅ Sva vozila procesirana za period ${nextBatch.start_time} - ${nextBatch.end_time}`);
  } catch (error) {
    console.error('❌ Greška u continuous parallel processing-u:', error);
  }
}

/**
 * Check parallel processing status
 */
async function checkParallelStatus() {
  const client = new Client({
    connectionString: process.env.TIMESCALE_DATABASE_URL ||
      'postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps?sslmode=disable'
  });

  try {
    await client.connect();

    // Check processing queue
    const queueResult = await client.query('SELECT * FROM get_processing_queue(24)');

    console.log('\n📊 Processing Queue (poslednja 24h):');
    console.log('─'.repeat(120));
    console.log(
      'Period Start'.padEnd(20) +
      'Period End'.padEnd(20) +
      'Total'.padEnd(8) +
      'Pending'.padEnd(10) +
      'Processing'.padEnd(12) +
      'Completed'.padEnd(12) +
      'Failed'.padEnd(8) +
      'Est. Rows'
    );
    console.log('─'.repeat(120));

    queueResult.rows.forEach(row => {
      const start = new Date(row.period_start).toLocaleString('sr-RS', { hour: '2-digit', minute: '2-digit' });
      const end = new Date(row.period_end).toLocaleString('sr-RS', { hour: '2-digit', minute: '2-digit' });
      console.log(
        start.padEnd(20) +
        end.padEnd(20) +
        String(row.total_vehicles).padEnd(8) +
        String(row.pending_vehicles).padEnd(10) +
        String(row.processing_vehicles).padEnd(12) +
        String(row.completed_vehicles).padEnd(12) +
        String(row.failed_vehicles).padEnd(8) +
        String(row.estimated_total_rows)
      );
    });

    // Check active parallel batches
    const activeResult = await client.query('SELECT * FROM v_parallel_processing_status LIMIT 10');

    if (activeResult.rows.length > 0) {
      console.log('\n🔄 Aktivni Parallel Batch-evi:');
      console.log('─'.repeat(120));
      activeResult.rows.forEach(row => {
        const healthIcon = row.health_status === 'OK' ? '✅' : row.health_status === 'WARNING' ? '⚠️' : '❌';
        console.log(`${healthIcon} Batch ${row.id}: Vozilo ${row.vehicle_id || 'ALL'} - ${row.status} (${row.progress_percent || 0}%)`);
        console.log(`   Period: ${new Date(row.start_time).toLocaleString()} - ${new Date(row.end_time).toLocaleString()}`);
        console.log(`   Redova: ${row.rows_processed || 0} / Outlier-a: ${row.rows_filtered || 0}`);
        console.log(`   Lock: ${row.has_lock ? 'DA' : 'NE'} | PID: ${row.lock_pid || 'N/A'} | Heartbeat: ${row.heartbeat_age || 'N/A'}`);
        if (row.error_message) {
          console.log(`   ❌ Greška: ${row.error_message}`);
        }
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Greška u proveri parallel statusa:', error);
  } finally {
    await client.end();
  }
}

/**
 * Test connection
 */
async function testConnection() {
  const client = new Client({
    connectionString: process.env.TIMESCALE_DATABASE_URL ||
      'postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps?sslmode=disable'
  });

  try {
    await client.connect();
    const result = await client.query('SELECT NOW() as time');
    console.log('✅ Konekcija uspešna. Server vreme:', result.rows[0].time);
    return true;
  } catch (error) {
    console.error('❌ Konekcija neuspešna:', error);
    return false;
  } finally {
    await client.end();
  }
}

/**
 * Main funkcija
 */
async function main() {
  const mode = process.argv[2] || 'continuous';

  console.log('🚀 GPS Batch Processor');
  console.log(`   Mode: ${mode}`);
  console.log('');

  // Test konekciju prvo
  const connected = await testConnection();
  if (!connected && mode !== 'test') {
    console.error('❌ Ne mogu se povezati na TimescaleDB');
    process.exit(1);
  }

  switch (mode) {
    case 'continuous':
      // Pokreni jednom
      await continuousProcess();
      break;

    case 'parallel':
      // Parallel processing jednom
      const maxParallel = parseInt(process.argv[3] || '5');
      await continuousParallelProcess(maxParallel);
      break;

    case 'parallel-cron':
      // Parallel processing svakih 15 minuta
      const maxParallelCron = parseInt(process.argv[3] || '5');
      console.log(`⏰ Schedulovan parallel cron job za svakih 15 minuta (max ${maxParallelCron} vozila)`);
      cron.schedule('*/15 * * * *', async () => {
        console.log(`\n⏰ [${new Date().toISOString()}] Parallel cron job pokrenut`);
        await continuousParallelProcess(maxParallelCron);
      });
      break;

    case 'cron':
      // Pokreni svakih 15 minuta
      console.log('⏰ Schedulovan cron job za svakih 15 minuta');
      cron.schedule('*/15 * * * *', async () => {
        console.log(`\n⏰ [${new Date().toISOString()}] Cron job pokrenut`);
        await continuousProcess();
      });
      break;

    case 'backfill':
      // Procesira specifični period
      const startDate = process.argv[3] ? new Date(process.argv[3]) : subHours(new Date(), 24);
      const endDate = process.argv[4] ? new Date(process.argv[4]) : new Date();
      const hoursPerBatch = parseInt(process.argv[5] || '1');

      await backfillProcess(startDate, endDate, hoursPerBatch);
      break;

    case 'retry':
      // Retry failed batches
      const maxRetries = parseInt(process.argv[3] || '3');
      await retryFailedBatches(maxRetries);
      break;

    case 'status':
      // Prikaži status
      await checkStatus();
      break;

    case 'parallel-status':
      // Prikaži parallel status
      await checkParallelStatus();
      break;

    case 'test':
      // Test konekciju
      break;

    default:
      console.log('Nepoznat mode. Dostupni modovi:');
      console.log('  - continuous: Procesira jednom sve nove podatke');
      console.log('  - parallel [max_parallel]: Parallel processing više vozila (default: 5)');
      console.log('  - parallel-cron [max_parallel]: Parallel processing svakih 15 min (default: 5)');
      console.log('  - cron: Pokreće se svakih 15 minuta');
      console.log('  - backfill [start] [end] [hours]: Procesira istorijske podatke');
      console.log('  - retry [max_retries]: Ponovo pokreće neuspešne batch-eve');
      console.log('  - status: Prikazuje trenutni status');
      console.log('  - parallel-status: Prikazuje status parallel processing-a');
      console.log('  - test: Testira konekciju');
      process.exit(1);
  }

  // Za cron mode, drži proces živ
  if (mode === 'cron' || mode === 'parallel-cron') {
    // Keep process alive
    process.stdin.resume();
  }
}

// Pokreni
main().catch(error => {
  console.error('❌ Fatalna greška:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Zaustavljanje...');
  process.exit(0);
});