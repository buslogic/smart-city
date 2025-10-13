/**
 * GPS Processing Monitor
 *
 * Real-time praćenje GPS batch procesiranja
 * - Processing overview
 * - Health check
 * - Performance metrics
 * - Recommendations
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Client } from 'pg';

const TIMESCALE_URL = process.env.TIMESCALE_DATABASE_URL ||
  'postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps?sslmode=disable';

interface ProcessingOverview {
  total_raw_points: string;
  total_vehicles: number;
  earliest_data: Date;
  latest_data: Date;
  total_processed_points: string;
  processed_vehicles: number;
  total_outliers: string;
  earliest_processed: Date;
  latest_processed: Date;
  last_processing_time: Date;
  processing_percentage: string;
  outlier_percentage: string;
  total_batches: string;
  completed_batches: string;
  failed_batches: string;
  active_batches: string;
  avg_processing_seconds: string;
  processing_lag: string;
  estimated_hours_to_completion: string;
}

interface HealthCheck {
  check_name: string;
  status: string;
  message: string;
  details: any;
}

interface Recommendation {
  recommendation_type: string;
  priority: string;
  message: string;
  action: string;
}

async function printDivider(char: string = '═', length: number = 120) {
  console.log(char.repeat(length));
}

async function printHeader(title: string) {
  await printDivider();
  console.log(`  ${title}`);
  await printDivider();
}

async function getProcessingOverview(client: Client): Promise<ProcessingOverview | null> {
  const result = await client.query('SELECT * FROM v_processing_overview');
  return result.rows[0] || null;
}

async function getHealthCheck(client: Client): Promise<HealthCheck[]> {
  const result = await client.query('SELECT * FROM get_health_check()');
  return result.rows;
}

async function getRecommendations(client: Client): Promise<Recommendation[]> {
  const result = await client.query('SELECT * FROM get_processing_recommendations()');
  return result.rows;
}

async function getVehicleProgress(client: Client, limit: number = 10) {
  const result = await client.query(
    'SELECT * FROM v_vehicle_processing_progress ORDER BY progress_percentage ASC LIMIT $1',
    [limit]
  );
  return result.rows;
}

async function getOutlierAnalysis(client: Client, limit: number = 5) {
  const result = await client.query(
    'SELECT * FROM v_outlier_analysis LIMIT $1',
    [limit]
  );
  return result.rows;
}

async function getHourlyRate(client: Client, hours: number = 24) {
  const result = await client.query(
    'SELECT * FROM v_hourly_processing_rate LIMIT $1',
    [hours]
  );
  return result.rows;
}

function getStatusIcon(status: string): string {
  switch (status.toUpperCase()) {
    case 'OK': return '✅';
    case 'WARNING': return '⚠️';
    case 'CRITICAL': return '❌';
    case 'LOW': return '🔽';
    default: return 'ℹ️';
  }
}

function getPriorityIcon(priority: string): string {
  switch (priority.toUpperCase()) {
    case 'HIGH': return '🔴';
    case 'MEDIUM': return '🟡';
    case 'LOW': return '🟢';
    default: return 'ℹ️';
  }
}

async function displayOverview(overview: ProcessingOverview) {
  await printHeader('📊 GPS PROCESSING OVERVIEW');

  console.log('\n🗄️  RAW DATA:');
  console.log(`   Total GPS Points:  ${parseInt(overview.total_raw_points).toLocaleString()}`);
  console.log(`   Total Vehicles:    ${overview.total_vehicles}`);
  console.log(`   Earliest Data:     ${new Date(overview.earliest_data).toLocaleString('sr-RS')}`);
  console.log(`   Latest Data:       ${new Date(overview.latest_data).toLocaleString('sr-RS')}`);

  console.log('\n✅ PROCESSED DATA:');
  console.log(`   Processed Points:  ${parseInt(overview.total_processed_points || '0').toLocaleString()}`);
  console.log(`   Processed Vehicles: ${overview.processed_vehicles || 0}`);
  console.log(`   Total Outliers:    ${parseInt(overview.total_outliers || '0').toLocaleString()}`);
  console.log(`   Latest Processed:  ${overview.latest_processed ? new Date(overview.latest_processed).toLocaleString('sr-RS') : 'N/A'}`);

  console.log('\n📈 PROGRESS:');
  const progressPct = parseFloat(overview.processing_percentage || '0');
  const progressBar = '█'.repeat(Math.floor(progressPct / 2)) + '░'.repeat(50 - Math.floor(progressPct / 2));
  console.log(`   Processing:        [${progressBar}] ${progressPct.toFixed(2)}%`);
  console.log(`   Outlier Rate:      ${overview.outlier_percentage}%`);
  console.log(`   Processing Lag:    ${overview.processing_lag || 'N/A'}`);

  if (parseFloat(overview.estimated_hours_to_completion) > 0) {
    console.log(`   Est. Completion:   ${overview.estimated_hours_to_completion} hours`);
  }

  console.log('\n📦 BATCH STATISTICS:');
  console.log(`   Total Batches:     ${overview.total_batches || 0}`);
  console.log(`   Completed:         ${overview.completed_batches || 0}`);
  console.log(`   Failed:            ${overview.failed_batches || 0}`);
  console.log(`   Active:            ${overview.active_batches || 0}`);
  console.log(`   Avg. Time:         ${overview.avg_processing_seconds || 0}s`);
  console.log('');
}

async function displayHealthCheck(healthChecks: HealthCheck[]) {
  await printHeader('🏥 HEALTH CHECK');
  console.log('');

  healthChecks.forEach(check => {
    const icon = getStatusIcon(check.status);
    console.log(`${icon} ${check.check_name.padEnd(30)} ${check.status.padEnd(10)} ${check.message}`);
  });
  console.log('');
}

async function displayRecommendations(recommendations: Recommendation[]) {
  if (recommendations.length === 0) {
    console.log('\n✅ Nema preporuka - sistem radi optimalno!\n');
    return;
  }

  await printHeader('💡 RECOMMENDATIONS');
  console.log('');

  recommendations.forEach(rec => {
    const icon = getPriorityIcon(rec.priority);
    console.log(`${icon} [${rec.priority}] ${rec.recommendation_type}`);
    console.log(`   📝 ${rec.message}`);
    console.log(`   🔧 ${rec.action}`);
    console.log('');
  });
}

async function displayVehicleProgress(vehicles: any[]) {
  await printHeader('🚗 VEHICLE PROCESSING PROGRESS (Top 10 Slowest)');
  console.log('');

  if (vehicles.length === 0) {
    console.log('ℹ️  Nema podataka o napretku vozila\n');
    return;
  }

  console.log(
    'Vehicle ID'.padEnd(12) +
    'Garage No'.padEnd(12) +
    'Progress'.padEnd(12) +
    'Processed'.padEnd(15) +
    'Remaining'.padEnd(15) +
    'Outliers'.padEnd(12) +
    'Lag'
  );
  await printDivider('─');

  vehicles.forEach(v => {
    const progress = parseFloat(v.progress_percentage || '0');
    const progressBar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));

    console.log(
      String(v.vehicle_id).padEnd(12) +
      (v.garage_no || 'N/A').padEnd(12) +
      `${progressBar} ${progress.toFixed(1)}%`.padEnd(12) +
      String(v.processed_points).toLocaleString().padEnd(15) +
      String(v.remaining_points).toLocaleString().padEnd(15) +
      `${v.outliers} (${v.outlier_percentage}%)`.padEnd(12) +
      (v.processing_lag || 'N/A')
    );
  });
  console.log('');
}

async function displayOutlierAnalysis(outliers: any[]) {
  await printHeader('🔍 OUTLIER ANALYSIS (Top 5)');
  console.log('');

  if (outliers.length === 0) {
    console.log('✅ Nema outlier-a\n');
    return;
  }

  console.log(
    'Type'.padEnd(20) +
    'Severity'.padEnd(12) +
    'Count'.padEnd(12) +
    'Vehicles'.padEnd(12) +
    'Avg Speed'.padEnd(15) +
    'Avg Distance'
  );
  await printDivider('─');

  outliers.forEach(o => {
    console.log(
      (o.outlier_type || 'N/A').padEnd(20) +
      (o.outlier_severity || 'N/A').padEnd(12) +
      String(o.total_count).toLocaleString().padEnd(12) +
      String(o.affected_vehicles).padEnd(12) +
      `${parseFloat(o.avg_speed || '0').toFixed(2)} km/h`.padEnd(15) +
      `${parseFloat(o.avg_distance || '0').toFixed(2)} m`
    );
  });
  console.log('');
}

async function displayHourlyRate(rates: any[]) {
  await printHeader('⏱️  HOURLY PROCESSING RATE (Last 24h)');
  console.log('');

  if (rates.length === 0) {
    console.log('ℹ️  Nema podataka o brzini procesiranja\n');
    return;
  }

  console.log(
    'Hour'.padEnd(22) +
    'Batches'.padEnd(10) +
    'Rows Processed'.padEnd(18) +
    'Outliers'.padEnd(12) +
    'Avg Time'.padEnd(12) +
    'Rows/sec'
  );
  await printDivider('─');

  rates.slice(0, 12).forEach(r => {
    console.log(
      new Date(r.processing_hour).toLocaleString('sr-RS').padEnd(22) +
      String(r.batches_completed).padEnd(10) +
      String(r.total_rows_processed || 0).toLocaleString().padEnd(18) +
      String(r.total_outliers || 0).toLocaleString().padEnd(12) +
      `${r.avg_seconds_per_batch || 0}s`.padEnd(12) +
      String(r.rows_per_second || 0).toLocaleString()
    );
  });
  console.log('');
}

async function runMonitor(mode: string = 'full') {
  const client = new Client({ connectionString: TIMESCALE_URL });

  try {
    await client.connect();
    console.clear();
    console.log('\n🚀 GPS PROCESSING MONITOR');
    console.log(`   Vreme: ${new Date().toLocaleString('sr-RS')}\n`);

    if (mode === 'full' || mode === 'overview') {
      const overview = await getProcessingOverview(client);
      if (overview) {
        await displayOverview(overview);
      }
    }

    if (mode === 'full' || mode === 'health') {
      const healthChecks = await getHealthCheck(client);
      await displayHealthCheck(healthChecks);
    }

    if (mode === 'full' || mode === 'recommendations') {
      const recommendations = await getRecommendations(client);
      await displayRecommendations(recommendations);
    }

    if (mode === 'full' || mode === 'vehicles') {
      const vehicles = await getVehicleProgress(client, 10);
      await displayVehicleProgress(vehicles);
    }

    if (mode === 'full' || mode === 'outliers') {
      const outliers = await getOutlierAnalysis(client, 5);
      await displayOutlierAnalysis(outliers);
    }

    if (mode === 'full' || mode === 'rate') {
      const rates = await getHourlyRate(client, 24);
      await displayHourlyRate(rates);
    }

    await printDivider();
    console.log('✅ Monitoring završen\n');

  } catch (error) {
    console.error('❌ Greška:', error);
  } finally {
    await client.end();
  }
}

async function watchMode(intervalSeconds: number = 30) {
  console.log(`\n👀 Watch Mode - Refresh svakih ${intervalSeconds} sekundi`);
  console.log('   Press Ctrl+C to stop\n');

  await runMonitor('full');

  setInterval(async () => {
    await runMonitor('full');
  }, intervalSeconds * 1000);
}

// Main
const mode = process.argv[2] || 'full';
const watchInterval = parseInt(process.argv[3] || '30');

if (mode === 'watch') {
  watchMode(watchInterval).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
} else {
  runMonitor(mode).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
