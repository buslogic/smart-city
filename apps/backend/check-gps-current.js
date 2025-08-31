const { PrismaClient } = require('@prisma/client');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Pravilna dekripcija
const algorithm = 'aes-256-cbc';
const key = process.env.DATABASE_ENCRYPTION_KEY || 'default-key-for-dev-only';
const encryptionKey = crypto.scryptSync(key, 'salt', 32);

function decryptPassword(encryptedPassword) {
  try {
    const parts = encryptedPassword.split(':');
    if (parts.length !== 2) {
      return encryptedPassword;
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return encryptedPassword;
  }
}

async function checkCurrentTable() {
  try {
    // Prvo dohvatimo kredencijale iz baze
    const legacyDb = await prisma.legacyDatabase.findFirst({
      where: {
        subtype: 'city_gps_ticketing_database'
      }
    });

    if (!legacyDb) {
      console.log('Gradska GPS Ticketing baza nije pronađena u konfiguraciji');
      return;
    }

    console.log('=== POVEZIVANJE SA LEGACY BAZOM ===');
    console.log(`Host: ${legacyDb.host}:${legacyDb.port}`);
    console.log(`Database: ${legacyDb.database}`);
    console.log(`Subtype: ${legacyDb.subtype}`);

    // Dekriptuj password
    const decryptedPassword = decryptPassword(legacyDb.password);
    console.log(`   Koristim password: ***${decryptedPassword.slice(-4)}`);
    
    // Kreiraj konekciju
    const connection = await mysql.createConnection({
      host: legacyDb.host,
      port: legacyDb.port,
      user: legacyDb.username,
      password: decryptedPassword,
      database: legacyDb.database
    });

    console.log('\n✅ Uspešno povezan sa legacy bazom');

    // Proveri strukturu current tabele
    console.log('\n=== STRUKTURA CURRENT TABELE ===');
    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM current
    `);
    
    console.log('\nKolone u current tabeli:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
    });

    // Prebroj zapise
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total FROM current
    `);
    console.log(`\n📊 Ukupan broj zapisa u current tabeli: ${countResult[0].total}`);

    // Prikazi prvih nekoliko zapisa
    console.log('\n=== PRIMERI PODATAKA (prvih 5) ===');
    const [rows] = await connection.execute(`
      SELECT * FROM current 
      ORDER BY captured DESC 
      LIMIT 5
    `);

    if (rows.length > 0) {
      // Prikazi prvi red sa svim kolonama
      console.log('\nPrimer jednog zapisa (sva polja):');
      const firstRow = rows[0];
      Object.keys(firstRow).forEach(key => {
        const value = firstRow[key];
        console.log(`  ${key}: ${value !== null ? value : 'NULL'}`);
      });

      // Prikazi tabelu sa ključnim podacima
      console.log('\n=== TABELARNI PRIKAZ ===');
      console.log('GarageNo | Lat | Lng | Brzina | Vreme | Linija | Smer');
      console.log('-----------------------------------------------------------------------');
      rows.forEach(row => {
        const captured = new Date(row.captured).toLocaleString('sr-RS');
        const direction = row.direction === 1 ? 'A' : 'B';
        console.log(
          `${row.garageNo} | ${row.lat} | ${row.lng} | ${row.speed} km/h | ${captured} | ${row.line_number || 'N/A'} | ${direction}`
        );
      });
    }

    // Proveri unique vozila
    const [uniqueVehicles] = await connection.execute(`
      SELECT COUNT(DISTINCT garageNo) as unique_vehicles 
      FROM current 
      WHERE garageNo IS NOT NULL
    `);
    console.log(`\n🚌 Broj jedinstvenih vozila sa GPS podacima: ${uniqueVehicles[0].unique_vehicles}`);

    // Proveri poslednje vreme ažuriranja
    const [lastUpdate] = await connection.execute(`
      SELECT MAX(captured) as last_update 
      FROM current
    `);
    console.log(`\n🕒 Poslednje ažuriranje: ${lastUpdate[0].last_update}`);

    await connection.end();
    console.log('\n✅ Konekcija zatvorena');

  } catch (error) {
    console.error('Greška:', error.message);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('⚠️ Tabela "current" ne postoji u bazi');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentTable();