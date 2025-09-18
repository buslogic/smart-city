import * as mysql from 'mysql2/promise';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Dekriptovanje passworda
function decryptPassword(encryptedPassword: string): string {
  try {
    const parts = encryptedPassword.split(':');
    if (parts.length !== 2) {
      return encryptedPassword;
    }

    const algorithm = 'aes-256-cbc';
    const keySource =
      process.env.DATABASE_ENCRYPTION_KEY || 'default-key-for-dev-only';
    const key = crypto.scryptSync(keySource, 'salt', 32);

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.log('⚠️ Dekriptovanje nije uspelo, koristi se plain text');
    return encryptedPassword;
  }
}

async function importTodayGPSData() {
  let mysqlConnection: mysql.Connection | null = null;
  let pgPool: Pool | null = null;

  // Početak merenja vremena
  const startTime = Date.now();
  console.log(
    `⏱️ Početak sinhronizacije: ${new Date().toLocaleString('sr-RS')}`,
  );

  try {
    // 1. Dohvati kredencijale za legacy bazu
    console.log('\n📋 Dohvatam kredencijale za legacy bazu...');
    const legacyDb = await prisma.legacyDatabase.findFirst({
      where: {
        subtype: 'city_gps_ticketing_database',
        isActive: true,
      },
    });

    if (!legacyDb) {
      throw new Error('GPS legacy baza nije konfigurisana');
    }

    const password = decryptPassword(legacyDb.password);

    // 2. Konektuj se na legacy MySQL bazu
    console.log('🔗 Povezujem se na legacy GPS bazu...');
    mysqlConnection = await mysql.createConnection({
      host: legacyDb.host,
      port: legacyDb.port,
      user: legacyDb.username,
      password: password,
      database: legacyDb.database,
      connectTimeout: 30000,
    });

    console.log('✅ Povezan na legacy bazu');

    // 3. Preuzmi podatke za CEL DANAŠNJI DAN
    const vehicleGarageNo = 'P93597';
    console.log(
      `\n📊 Preuzimam podatke za vozilo ${vehicleGarageNo} za CEL DANAŠNJI DAN...`,
    );

    // Početak današnjeg dana (00:00:00)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Brojanje postojećih podataka u TimescaleDB za danas
    console.log('\n🔍 Proveravam postojeće podatke u TimescaleDB...');
    // Koristi environment varijable ili baci grešku
    if (!process.env.TIMESCALE_DATABASE_URL) {
      throw new Error('TIMESCALE_DATABASE_URL environment variable is not set');
    }

    pgPool = new Pool({
      connectionString: process.env.TIMESCALE_DATABASE_URL,
      max: 5,
    });

    const existingCountResult = await pgPool.query(
      `
      SELECT COUNT(*) as existing_count,
             MIN(time) as first_point,
             MAX(time) as last_point
      FROM gps_data
      WHERE garage_no = $1
        AND time >= $2::timestamp
    `,
      [vehicleGarageNo, todayStart.toISOString()],
    );

    const existingData = existingCountResult.rows[0];
    console.log(`📌 Postojeći podaci za danas:`);
    console.log(`   - Broj tačaka: ${existingData.existing_count}`);
    if (existingData.existing_count > 0) {
      console.log(`   - Prva tačka: ${existingData.first_point}`);
      console.log(`   - Poslednja tačka: ${existingData.last_point}`);
    }

    // Query za ceo današnji dan
    const queryStartTime = Date.now();
    const [rows] = await mysqlConnection.execute(`
      SELECT 
        '${vehicleGarageNo}' as garageNo,
        lat,
        lng,
        speed,
        course,
        alt,
        state,
        inroute,
        captured,
        edited
      FROM \`${vehicleGarageNo}gps\`
      WHERE DATE(captured) = CURDATE()
        AND lat IS NOT NULL
        AND lng IS NOT NULL
      ORDER BY captured ASC
    `);
    const queryTime = Date.now() - queryStartTime;

    const gpsData = rows as any[];
    console.log(`\n✅ Pronađeno ${gpsData.length} GPS tačaka za današnji dan`);
    console.log(
      `⏱️ Vreme čitanja iz MySQL: ${(queryTime / 1000).toFixed(2)} sekundi`,
    );

    if (gpsData.length === 0) {
      console.log('⚠️ Nema podataka za današnji dan');
      return;
    }

    // Analiza podataka
    const firstPoint = gpsData[0];
    const lastPoint = gpsData[gpsData.length - 1];
    console.log(`\n📅 Period podataka:`);
    console.log(`   - Od: ${firstPoint.captured}`);
    console.log(`   - Do: ${lastPoint.captured}`);

    // 4. Pronađi vehicle_id za ovaj garageNo
    const vehicle = await prisma.busVehicle.findFirst({
      where: { garageNumber: vehicleGarageNo },
    });

    const vehicleId = vehicle?.id || null;
    console.log(
      `\n🚌 Vehicle ID za ${vehicleGarageNo}: ${vehicleId || 'nije pronađen'}`,
    );

    // 5. Ubaci podatke u TimescaleDB sa merenjem vremena
    console.log(
      `\n📥 Započinje ubacivanje ${gpsData.length} GPS tačaka u TimescaleDB...`,
    );

    const insertStartTime = Date.now();
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const batchSize = 100; // Batch insert za bolje performanse

    // Rad sa batch-evima
    for (let i = 0; i < gpsData.length; i += batchSize) {
      const batch = gpsData.slice(i, i + batchSize);
      const batchStartTime = Date.now();

      for (const point of batch) {
        try {
          const query = `
            INSERT INTO gps_data (
              time, vehicle_id, garage_no, lat, lng, location,
              speed, course, alt, state, in_route, data_source
            ) VALUES (
              $1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326),
              $8, $9, $10, $11, $12, $13
            ) ON CONFLICT (time, garage_no) DO UPDATE SET
              lat = EXCLUDED.lat,
              lng = EXCLUDED.lng,
              location = EXCLUDED.location,
              speed = EXCLUDED.speed
            RETURNING (xmax = 0) as is_inserted
          `;

          const result = await pgPool.query(query, [
            new Date(point.captured),
            vehicleId,
            point.garageNo,
            parseFloat(point.lat),
            parseFloat(point.lng),
            parseFloat(point.lng), // za ST_MakePoint
            parseFloat(point.lat), // za ST_MakePoint
            point.speed || 0,
            point.course || 0,
            point.alt || 0,
            point.state || 0,
            point.inroute || 0,
            'legacy_import_today',
          ]);

          if (result.rows[0]?.is_inserted) {
            inserted++;
          } else {
            updated++;
          }
        } catch (error: any) {
          console.error(`❌ Greška pri unosu tačke:`, error.message);
          failed++;
        }
      }

      const batchTime = Date.now() - batchStartTime;
      const progress = Math.min(i + batchSize, gpsData.length);
      console.log(
        `  Batch ${Math.floor(i / batchSize) + 1}: Obrađeno ${progress}/${gpsData.length} tačaka (${(batchTime / 1000).toFixed(2)}s)`,
      );
    }

    const insertTime = Date.now() - insertStartTime;

    console.log(`\n✅ Import završen!`);
    console.log(`   - Novo ubačeno: ${inserted} tačaka`);
    console.log(`   - Ažurirano: ${updated} tačaka`);
    console.log(`   - Neuspešno: ${failed} tačaka`);
    console.log(
      `⏱️ Vreme ubacivanja: ${(insertTime / 1000).toFixed(2)} sekundi`,
    );
    console.log(
      `📊 Brzina: ${(gpsData.length / (insertTime / 1000)).toFixed(0)} tačaka/sekund`,
    );

    // 6. Finalna statistika u TimescaleDB
    console.log('\n📊 Finalna statistika u TimescaleDB za danas:');

    const finalStats = await pgPool.query(
      `
      SELECT 
        COUNT(*) as total_points,
        MIN(time) as oldest_point,
        MAX(time) as newest_point,
        AVG(speed)::NUMERIC(5,2) as avg_speed,
        MAX(speed) as max_speed,
        COUNT(DISTINCT DATE_TRUNC('hour', time)) as active_hours
      FROM gps_data
      WHERE garage_no = $1
        AND time >= $2::timestamp
    `,
      [vehicleGarageNo, todayStart.toISOString()],
    );

    const stats = finalStats.rows[0];
    console.log(`   - Ukupno tačaka danas: ${stats.total_points}`);
    console.log(`   - Najstarija tačka: ${stats.oldest_point}`);
    console.log(`   - Najnovija tačka: ${stats.newest_point}`);
    console.log(`   - Prosečna brzina: ${stats.avg_speed} km/h`);
    console.log(`   - Maksimalna brzina: ${stats.max_speed} km/h`);
    console.log(`   - Aktivnih sati: ${stats.active_hours}`);

    // 7. Računaj kilometražu za danas
    const distanceResult = await pgPool.query(
      `
      WITH ordered_points AS (
        SELECT 
          time,
          location,
          speed,
          LAG(location) OVER (ORDER BY time) as prev_location,
          LAG(time) OVER (ORDER BY time) as prev_time
        FROM gps_data
        WHERE garage_no = $1
          AND time >= $2::timestamp
        ORDER BY time
      )
      SELECT 
        COUNT(*) as segments,
        SUM(
          ST_Distance(
            prev_location::geography,
            location::geography
          )
        ) / 1000.0 as total_km,
        AVG(
          ST_Distance(
            prev_location::geography,
            location::geography
          )
        )::NUMERIC(10,2) as avg_segment_meters
      FROM ordered_points
      WHERE prev_location IS NOT NULL
    `,
      [vehicleGarageNo, todayStart.toISOString()],
    );

    const distance = distanceResult.rows[0];
    console.log(`\n🗺️ PostGIS kalkulacije za danas:`);
    console.log(`   - Segmenata rute: ${distance.segments}`);
    console.log(
      `   - Ukupna kilometraža: ${parseFloat(distance.total_km).toFixed(2)} km`,
    );
    console.log(
      `   - Prosečna dužina segmenta: ${distance.avg_segment_meters} m`,
    );

    // 8. Finalno vreme izvršavanja
    const totalTime = Date.now() - startTime;
    console.log(
      `\n⏱️ UKUPNO VREME SINHRONIZACIJE: ${(totalTime / 1000).toFixed(2)} sekundi`,
    );
    console.log(
      `   - Čitanje iz MySQL: ${(queryTime / 1000).toFixed(2)} sekundi (${((queryTime / totalTime) * 100).toFixed(1)}%)`,
    );
    console.log(
      `   - Ubacivanje u TimescaleDB: ${(insertTime / 1000).toFixed(2)} sekundi (${((insertTime / totalTime) * 100).toFixed(1)}%)`,
    );
    console.log(
      `   - Ostale operacije: ${((totalTime - queryTime - insertTime) / 1000).toFixed(2)} sekundi`,
    );

    // Performanse
    console.log(`\n📈 Performanse:`);
    console.log(
      `   - Ukupna brzina: ${(gpsData.length / (totalTime / 1000)).toFixed(0)} tačaka/sekund`,
    );
    console.log(
      `   - Prosečno vreme po tački: ${(totalTime / gpsData.length).toFixed(2)} ms`,
    );
  } catch (error) {
    console.error('❌ Greška:', error);
    const errorTime = Date.now() - startTime;
    console.log(`⏱️ Vreme do greške: ${(errorTime / 1000).toFixed(2)} sekundi`);
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end();
    }
    if (pgPool) {
      await pgPool.end();
    }
    await prisma.$disconnect();
  }
}

// Pokreni import
console.log('🚀 Započinje import GPS podataka za DANAŠNJI DAN...\n');
console.log('='.repeat(60));
importTodayGPSData().catch(console.error);
