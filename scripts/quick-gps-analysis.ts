/**
 * Quick GPS Buffer Analysis
 * Run from backend folder: npx ts-node ../../scripts/quick-gps-analysis.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function quickAnalysis() {
  console.log('=====================================');
  console.log('GPS BUFFER QUICK ANALYSIS');
  console.log('Time:', new Date().toISOString());
  console.log('=====================================\n');

  try {
    // 1. STATUS DISTRIBUTION
    console.log('1. STATUS DISTRIBUTION:');
    console.log('-----------------------');
    const statusCounts = await prisma.$queryRaw<any[]>`
      SELECT 
        process_status,
        COUNT(*) as count,
        MIN(received_at) as oldest,
        MAX(received_at) as newest
      FROM gps_raw_buffer 
      GROUP BY process_status
      ORDER BY count DESC
    `;
    
    console.table(statusCounts.map(s => ({
      status: s.process_status,
      count: Number(s.count),
      oldest: s.oldest,
      newest: s.newest
    })));

    // 2. CHECK STUCK RECORDS
    console.log('\n2. STUCK PROCESSING CHECK:');
    console.log('--------------------------');
    const stuckRecords = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as stuck_count,
        MIN(processed_at) as oldest_stuck,
        TIMESTAMPDIFF(MINUTE, MIN(processed_at), NOW()) as minutes_stuck
      FROM gps_raw_buffer 
      WHERE process_status = 'processing'
        AND processed_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    `;
    
    if (stuckRecords[0]?.stuck_count > 0) {
      console.log(`⚠️  CRITICAL: ${stuckRecords[0].stuck_count} records stuck for ${stuckRecords[0].minutes_stuck} minutes!`);
      console.log('   FIX: UPDATE gps_raw_buffer SET process_status="pending" WHERE process_status="processing"');
    } else {
      console.log('✅ No stuck records');
    }

    // 3. ERROR MESSAGES
    console.log('\n3. TOP ERROR MESSAGES:');
    console.log('----------------------');
    const errorMessages = await prisma.$queryRaw<any[]>`
      SELECT 
        LEFT(error_message, 100) as error,
        COUNT(*) as count
      FROM gps_raw_buffer 
      WHERE process_status = 'failed' 
        AND error_message IS NOT NULL
      GROUP BY error_message
      ORDER BY count DESC
      LIMIT 5
    `;
    
    if (errorMessages.length > 0) {
      console.table(errorMessages.map(e => ({
        error: e.error?.substring(0, 50) + '...',
        count: Number(e.count)
      })));
    } else {
      console.log('✅ No error messages');
    }

    // 4. PROCESSING RATE
    console.log('\n4. PROCESSING RATE:');
    console.log('-------------------');
    const rateStats = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(CASE WHEN received_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as received_last_hour,
        COUNT(CASE WHEN processed_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) AND process_status = 'processed' THEN 1 END) as processed_last_hour
      FROM gps_raw_buffer
    `;
    
    const received = Number(rateStats[0]?.received_last_hour || 0);
    const processed = Number(rateStats[0]?.processed_last_hour || 0);
    const backlogIncrease = received - processed;
    
    console.log(`Received last hour: ${received}`);
    console.log(`Processed last hour: ${processed}`);
    console.log(`Backlog change: ${backlogIncrease > 0 ? '+' : ''}${backlogIncrease}`);
    console.log(`Processing rate: ${Math.round(processed / 3600)} records/second`);
    
    if (backlogIncrease > 1000) {
      console.log('⚠️  WARNING: System falling behind!');
    }

    // 5. TOTAL COUNTS
    console.log('\n5. SUMMARY:');
    console.log('-----------');
    const totalPending = statusCounts.find(s => s.process_status === 'pending')?.count || 0;
    const totalFailed = statusCounts.find(s => s.process_status === 'failed')?.count || 0;
    const totalProcessed = statusCounts.find(s => s.process_status === 'processed')?.count || 0;
    
    console.log(`Total pending: ${Number(totalPending).toLocaleString()}`);
    console.log(`Total failed: ${Number(totalFailed).toLocaleString()}`);
    console.log(`Total processed: ${Number(totalProcessed).toLocaleString()}`);
    
    // 6. RECOMMENDATIONS
    console.log('\n6. RECOMMENDATIONS:');
    console.log('-------------------');
    
    if (Number(totalPending) > 100000) {
      console.log('🔴 CRITICAL: Over 100k pending records!');
      console.log('   1. Increase batch size to 50000');
      console.log('   2. Increase workers to 10');
      console.log('   3. Reduce cron interval to 10 seconds');
    }
    
    if (Number(totalFailed) > 10000) {
      console.log('⚠️  HIGH FAILURE RATE');
      console.log('   Check error messages above for root cause');
    }
    
    if (stuckRecords[0]?.stuck_count > 0) {
      console.log('🔄 RESET STUCK RECORDS');
      console.log('   Run: UPDATE gps_raw_buffer SET process_status="pending" WHERE process_status="processing"');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

quickAnalysis().catch(console.error);