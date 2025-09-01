const mysql = require('mysql2/promise');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function decryptPassword(encryptedPassword) {
  try {
    const parts = encryptedPassword.split(':');
    if (parts.length !== 2) return encryptedPassword;
    
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
    return encryptedPassword;
  }
}

async function checkData() {
  let connection;
  
  try {
    // Dohvati kredencijale
    const legacyDb = await prisma.legacyDatabase.findFirst({
      where: {
        subtype: 'city_gps_ticketing_database',
        isActive: true,
      },
    });

    const password = decryptPassword(legacyDb.password);
    
    console.log('🔗 Povezujem se na legacy bazu...');
    connection = await mysql.createConnection({
      host: legacyDb.host,
      port: legacyDb.port,
      user: legacyDb.username,
      password: password,
      database: legacyDb.database,
      connectTimeout: 30000,
    });

    console.log('✅ Povezan\n');

    // Proveri podatke za P93597gps tabelu
    const dates = [
      '2025-08-28',
      '2025-08-29',
      '2025-08-30',
      '2025-08-31'
    ];

    console.log('📊 Provera podataka za vozilo P93597:\n');
    
    for (const date of dates) {
      try {
        const [rows] = await connection.execute(`
          SELECT 
            COUNT(*) as count,
            MIN(captured) as first,
            MAX(captured) as last
          FROM \`P93597gps\`
          WHERE DATE(captured) = ?
        `, [date]);
        
        const data = rows[0];
        console.log(`📅 ${date}:`);
        console.log(`   Broj GPS tačaka: ${data.count}`);
        if (data.count > 0) {
          console.log(`   Prva: ${data.first}`);
          console.log(`   Poslednja: ${data.last}`);
        }
        console.log();
      } catch (err) {
        console.log(`❌ Greška za ${date}: ${err.message}\n`);
      }
    }

    // Proveri ukupan broj podataka u tabeli
    const [total] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        MIN(captured) as oldest,
        MAX(captured) as newest
      FROM \`P93597gps\`
    `);
    
    console.log('📊 Ukupna statistika tabele P93597gps:');
    console.log(`   Ukupno redova: ${total[0].total}`);
    console.log(`   Najstariji podatak: ${total[0].oldest}`);
    console.log(`   Najnoviji podatak: ${total[0].newest}`);

    // Proveri poslednje dane sa podacima
    const [lastDays] = await connection.execute(`
      SELECT 
        DATE(captured) as date,
        COUNT(*) as count
      FROM \`P93597gps\`
      WHERE captured >= DATE_SUB(NOW(), INTERVAL 10 DAY)
      GROUP BY DATE(captured)
      ORDER BY date DESC
      LIMIT 10
    `);
    
    console.log('\n📅 Poslednji dani sa podacima:');
    lastDays.forEach(day => {
      console.log(`   ${day.date}: ${day.count} tačaka`);
    });

  } catch (error) {
    console.error('❌ Greška:', error.message);
  } finally {
    if (connection) await connection.end();
    await prisma.$disconnect();
  }
}

console.log('🚀 Provera podataka u legacy bazi...\n');
console.log('=' .repeat(60));
checkData().catch(console.error);