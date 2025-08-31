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
    const keySource = process.env.DATABASE_ENCRYPTION_KEY || 'default-key-for-dev-only';
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

async function importLegacyGPSData() {
  let mysqlConnection: mysql.Connection | null = null;
  let pgPool: Pool | null = null;
  
  try {
    // 1. Dohvati kredencijale za legacy bazu
    console.log('📋 Dohvatam kredencijale za legacy bazu...');
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

    // 3. Preuzmi podatke iz P93597gps tabele (poslednih 30 minuta)
    const vehicleGarageNo = 'P93597';
    console.log(`\n📊 Preuzimam podatke za vozilo ${vehicleGarageNo} (poslednih 30 minuta)...`);
    
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
      FROM ${vehicleGarageNo}gps
      WHERE captured > DATE_SUB(NOW(), INTERVAL 30 MINUTE)
        AND lat IS NOT NULL
        AND lng IS NOT NULL
      ORDER BY captured DESC
    `);

    const gpsData = rows as any[];
    console.log(`✅ Pronađeno ${gpsData.length} GPS tačaka za import`);

    if (gpsData.length === 0) {
      console.log('⚠️ Nema podataka u poslednjih 30 minuta, pokušavam poslednji dan...');
      
      const [dayRows] = await mysqlConnection.execute(`
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
        FROM ${vehicleGarageNo}gps
        WHERE captured > DATE_SUB(NOW(), INTERVAL 1 DAY)
          AND lat IS NOT NULL
          AND lng IS NOT NULL
        ORDER BY captured DESC
        LIMIT 1000
      `);
      
      const dayData = dayRows as any[];
      console.log(`✅ Pronađeno ${dayData.length} GPS tačaka za poslednji dan`);
      
      if (dayData.length > 0) {
        gpsData.push(...dayData);
      }
    }

    if (gpsData.length === 0) {
      console.log('⚠️ Nema podataka ni za poslednji dan');
      return;
    }

    // 4. Pronađi vehicle_id za ovaj garageNo
    const vehicle = await prisma.busVehicle.findFirst({
      where: { garageNumber: vehicleGarageNo },
    });

    const vehicleId = vehicle?.id || null;
    console.log(`Vehicle ID za ${vehicleGarageNo}: ${vehicleId || 'nije pronađen'}`);

    // 5. Konektuj se na TimescaleDB
    console.log('\n🔗 Povezujem se na TimescaleDB...');
    pgPool = new Pool({
      host: 'localhost',
      port: 5433,
      database: 'smartcity_gps',
      user: 'smartcity_ts',
      password: 'TimescalePass123!',
      max: 5,
    });

    // 6. Ubaci podatke u TimescaleDB
    console.log(`\n📥 Ubacujem ${gpsData.length} GPS tačaka u TimescaleDB...`);
    
    let inserted = 0;
    let failed = 0;

    for (const point of gpsData) {
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
        `;

        await pgPool.query(query, [
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
          'legacy_import'
        ]);
        
        inserted++;
        
        if (inserted % 100 === 0) {
          console.log(`  Ubačeno ${inserted}/${gpsData.length} tačaka...`);
        }
      } catch (error: any) {
        console.error(`Greška pri unosu tačke:`, error.message);
        failed++;
      }
    }

    console.log(`\n✅ Import završen!`);
    console.log(`   - Uspešno ubačeno: ${inserted} tačaka`);
    console.log(`   - Neuspešno: ${failed} tačaka`);

    // 7. Proveri podatke u TimescaleDB
    console.log('\n📊 Statistika u TimescaleDB:');
    
    const countResult = await pgPool.query(`
      SELECT 
        COUNT(*) as total_points,
        MIN(time) as oldest_point,
        MAX(time) as newest_point,
        AVG(speed)::NUMERIC(5,2) as avg_speed,
        MAX(speed) as max_speed
      FROM gps_data
      WHERE garage_no = $1
    `, [vehicleGarageNo]);

    const stats = countResult.rows[0];
    console.log(`   - Ukupno tačaka: ${stats.total_points}`);
    console.log(`   - Najstarija tačka: ${stats.oldest_point}`);
    console.log(`   - Najnovija tačka: ${stats.newest_point}`);
    console.log(`   - Prosečna brzina: ${stats.avg_speed} km/h`);
    console.log(`   - Maksimalna brzina: ${stats.max_speed} km/h`);

    // 8. Test PostGIS funkcija - računaj ukupnu kilometražu
    const distanceResult = await pgPool.query(`
      WITH ordered_points AS (
        SELECT 
          time,
          location,
          LAG(location) OVER (ORDER BY time) as prev_location
        FROM gps_data
        WHERE garage_no = $1
          AND time > NOW() - INTERVAL '1 day'
        ORDER BY time
      )
      SELECT 
        COUNT(*) as segments,
        SUM(
          ST_Distance(
            prev_location::geography,
            location::geography
          )
        ) / 1000.0 as total_km
      FROM ordered_points
      WHERE prev_location IS NOT NULL
    `, [vehicleGarageNo]);

    const distance = distanceResult.rows[0];
    console.log(`\n🗺️ PostGIS kalkulacije:`);
    console.log(`   - Segmenata rute: ${distance.segments}`);
    console.log(`   - Ukupna kilometraža (poslednji dan): ${parseFloat(distance.total_km).toFixed(2)} km`);

  } catch (error) {
    console.error('❌ Greška:', error);
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
console.log('🚀 Započinje import GPS podataka iz legacy baze...\n');
importLegacyGPSData().catch(console.error);