const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Isti algoritam i ključ kao u servisu
const algorithm = 'aes-256-cbc';
const key = process.env.DATABASE_ENCRYPTION_KEY || 'default-key-for-dev-only';
const encryptionKey = crypto.scryptSync(key, 'salt', 32);

function decryptPassword(encryptedPassword) {
  try {
    const parts = encryptedPassword.split(':');
    if (parts.length !== 2) {
      // Ako nije u očekivanom formatu, pretpostavi da je već plain text
      return encryptedPassword;
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // Ako dekripcija ne uspe, pretpostavi da je već plain text
    console.log('Greška pri dekripciji:', error.message);
    return encryptedPassword;
  }
}

async function testDecryption() {
  try {
    const gpsDb = await prisma.legacyDatabase.findFirst({
      where: {
        subtype: 'city_gps_ticketing_database'
      }
    });

    if (!gpsDb) {
      console.log('GPS baza nije pronađena');
      return;
    }

    console.log('=== TEST DEKRIPCIJE PASSWORD-A ===\n');
    console.log('Enkriptovan password:', gpsDb.password);
    
    const decrypted = decryptPassword(gpsDb.password);
    console.log('Dekriptovan password:', decrypted);
    console.log('Dužina password-a:', decrypted.length);
    
    // Testiraj konekciju sa dekriptovanim password-om
    const mysql = require('mysql2/promise');
    
    console.log('\n=== POKUŠAJ KONEKCIJE ===');
    console.log('Host:', gpsDb.host);
    console.log('Port:', gpsDb.port);
    console.log('Database:', gpsDb.database);
    console.log('Username:', gpsDb.username);
    
    try {
      const connection = await mysql.createConnection({
        host: gpsDb.host,
        port: gpsDb.port,
        user: gpsDb.username,
        password: decrypted,
        database: gpsDb.database,
        connectTimeout: 10000
      });
      
      console.log('\n✅ USPEŠNA KONEKCIJA!');
      
      // Proveri current tabelu
      const [rows] = await connection.execute('SELECT COUNT(*) as total FROM current');
      console.log(`Broj zapisa u current tabeli: ${rows[0].total}`);
      
      await connection.end();
      
    } catch (connError) {
      console.log('\n❌ GREŠKA PRI KONEKCIJI:', connError.message);
    }
    
  } catch (error) {
    console.error('Greška:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDecryption();