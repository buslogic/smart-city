/**
 * GPS Error Analysis Script
 * Analizira greške u GPS buffer tabeli i daje preporuke
 */

const mysql = require('mysql2/promise');
const { Client } = require('pg');

async function analyzeGPSErrors() {
  console.log('=====================================');
  console.log('GPS ERROR ANALYSIS');
  console.log('Time:', new Date().toISOString());
  console.log('=====================================\n');

  // MySQL connection
  const mysqlConn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: process.env.MYSQL_ROOT_PASSWORD || '',
    database: 'smartcity'
  });

  try {
    // 1. ANALIZA ERROR MESSAGES
    console.log('1. ERROR MESSAGE ANALYSIS:');
    console.log('--------------------------');
    const [errorMessages] = await mysqlConn.execute(`
      SELECT 
        error_message,
        COUNT(*) as count,
        MIN(received_at) as first_seen,
        MAX(received_at) as last_seen
      FROM gps_raw_buffer 
      WHERE process_status = 'failed' 
        AND error_message IS NOT NULL
      GROUP BY error_message
      ORDER BY count DESC
      LIMIT 10
    `);

    if (errorMessages.length > 0) {
      console.table(errorMessages.map(e => ({
        error: e.error_message?.substring(0, 50) + '...',
        count: e.count,
        first: e.first_seen,
        last: e.last_seen
      })));

      // Analyze specific errors
      for (const error of errorMessages) {
        if (error.error_message?.includes('duplicate key')) {
          console.log(`\n⚠️  DUPLICATE KEY ERROR (${error.count} records)`);
          console.log('   CAUSE: Trying to insert duplicate GPS points');
          console.log('   FIX: Clean duplicates or use ON CONFLICT');
        }
        else if (error.error_message?.includes('Connection refused') || error.error_message?.includes('ECONNREFUSED')) {
          console.log(`\n🔌 CONNECTION ERROR (${error.count} records)`);
          console.log('   CAUSE: TimescaleDB connection failed');
          console.log('   FIX: Check TimescaleDB is running: systemctl status timescaledb');
        }
        else if (error.error_message?.includes('timeout')) {
          console.log(`\n⏱️  TIMEOUT ERROR (${error.count} records)`);
          console.log('   CAUSE: Operation taking too long');
          console.log('   FIX: Reduce batch size or increase timeout');
        }
        else if (error.error_message?.includes('out of memory')) {
          console.log(`\n💾 MEMORY ERROR (${error.count} records)`);
          console.log('   CAUSE: Batch too large for available memory');
          console.log('   FIX: Reduce batch size');
        }
      }
    } else {
      console.log('✅ No error messages found');
    }

    // 2. CHECK VEHICLE-SPECIFIC ISSUES
    console.log('\n2. VEHICLE-SPECIFIC ISSUES:');
    console.log('----------------------------');
    const [vehicleErrors] = await mysqlConn.execute(`
      SELECT 
        v.garage_number,
        grb.vehicle_id,
        COUNT(*) as error_count,
        COUNT(DISTINCT error_message) as unique_errors
      FROM gps_raw_buffer grb
      LEFT JOIN bus_vehicles v ON v.id = grb.vehicle_id
      WHERE grb.process_status = 'failed'
      GROUP BY grb.vehicle_id, v.garage_number
      HAVING error_count > 100
      ORDER BY error_count DESC
      LIMIT 10
    `);

    if (vehicleErrors.length > 0) {
      console.table(vehicleErrors);
      console.log('⚠️  Some vehicles have persistent errors. Check GPS device status.');
    }

    // 3. CHECK DATA QUALITY ISSUES
    console.log('\n3. DATA QUALITY ISSUES:');
    console.log('------------------------');
    
    // Check for invalid coordinates
    const [invalidCoords] = await mysqlConn.execute(`
      SELECT COUNT(*) as count
      FROM gps_raw_buffer
      WHERE process_status = 'pending'
        AND (lat = 0 OR lng = 0 OR lat IS NULL OR lng IS NULL)
    `);
    
    if (invalidCoords[0].count > 0) {
      console.log(`⚠️  ${invalidCoords[0].count} records with invalid coordinates (0,0 or NULL)`);
    }

    // Check for future timestamps
    const [futureTimestamps] = await mysqlConn.execute(`
      SELECT COUNT(*) as count
      FROM gps_raw_buffer
      WHERE process_status = 'pending'
        AND timestamp > NOW()
    `);
    
    if (futureTimestamps[0].count > 0) {
      console.log(`⚠️  ${futureTimestamps[0].count} records with future timestamps`);
    }

    // 4. CHECK TIMESCALEDB CONNECTION
    console.log('\n4. TIMESCALEDB CONNECTION TEST:');
    console.log('--------------------------------');
    
    const pgClient = new Client({
      connectionString: process.env.TIMESCALE_DATABASE_URL || 
        'postgres://smartcity_ts:TimescalePass123!@localhost:5433/smartcity_gps'
    });
    
    try {
      await pgClient.connect();
      const result = await pgClient.query('SELECT COUNT(*) FROM gps_data WHERE time > NOW() - INTERVAL \'1 hour\'');
      console.log(`✅ TimescaleDB connected. Records in last hour: ${result.rows[0].count}`);
      await pgClient.end();
    } catch (pgError) {
      console.log(`❌ TimescaleDB connection failed: ${pgError.message}`);
      console.log('   FIX: Check connection string and TimescaleDB status');
    }

    // 5. PERFORMANCE BOTTLENECK CHECK
    console.log('\n5. PERFORMANCE BOTTLENECKS:');
    console.log('----------------------------');
    
    const [tableStatus] = await mysqlConn.execute(`
      SELECT 
        COUNT(*) as total_records,
        SUM(CASE WHEN process_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN process_status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN process_status = 'processed' THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN process_status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM gps_raw_buffer
    `);
    
    const stats = tableStatus[0];
    console.table(stats);
    
    // Calculate processing rate
    const [rateStats] = await mysqlConn.execute(`
      SELECT 
        COUNT(*) as processed_last_hour
      FROM gps_raw_buffer
      WHERE process_status = 'processed'
        AND processed_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);
    
    const processedPerHour = rateStats[0].processed_last_hour;
    const processedPerSecond = Math.round(processedPerHour / 3600);
    
    console.log(`\nProcessing Rate: ${processedPerSecond} records/second`);
    console.log(`At this rate, clearing ${stats.pending} pending records will take: ${Math.round(stats.pending / processedPerSecond / 60)} minutes`);
    
    // 6. RECOMMENDATIONS
    console.log('\n6. RECOMMENDATIONS:');
    console.log('--------------------');
    
    const recommendations = [];
    
    if (stats.processing > 1000) {
      recommendations.push({
        issue: 'STUCK PROCESSING',
        action: 'Reset stuck records',
        command: "UPDATE gps_raw_buffer SET process_status='pending', retry_count=0 WHERE process_status='processing'"
      });
    }
    
    if (stats.failed > 10000) {
      recommendations.push({
        issue: 'HIGH FAILURE RATE',
        action: 'Reset failed records for retry',
        command: "UPDATE gps_raw_buffer SET process_status='pending', retry_count=0 WHERE process_status='failed' AND retry_count < 3"
      });
    }
    
    if (stats.pending > 100000) {
      recommendations.push({
        issue: 'LARGE BACKLOG',
        action: 'Increase processing capacity',
        settings: {
          batchSize: 50000,
          workerCount: 10,
          cleanupProcessedMinutes: 1
        }
      });
    }
    
    if (processedPerSecond < 500) {
      recommendations.push({
        issue: 'SLOW PROCESSING',
        action: 'Optimize processing',
        tips: [
          'Enable Worker Pool',
          'Increase batch size',
          'Reduce cleanup interval',
          'Check TimescaleDB performance'
        ]
      });
    }
    
    if (recommendations.length > 0) {
      console.log(JSON.stringify(recommendations, null, 2));
    } else {
      console.log('✅ System is running optimally');
    }
    
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await mysqlConn.end();
  }
}

// Run analysis
analyzeGPSErrors().catch(console.error);