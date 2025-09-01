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

async function checkP93597gsp() {
  let connection;
  
  try {
    const legacyDb = await prisma.legacyDatabase.findFirst({
      where: {
        subtype: 'city_gps_ticketing_database',
        isActive: true,
      },
    });

    const password = decryptPassword(legacyDb.password);
    
    console.log('🔗 Povezujem se na bazu...');
    connection = await mysql.createConnection({
      host: legacyDb.host,
      port: legacyDb.port,
      user: legacyDb.username,
      password: password,
      database: legacyDb.database,
      connectTimeout: 30000,
    });

    // Direktno proveri P93597gsp tabelu
    console.log('\n🔍 Proveravam P93597gsp tabelu...');
    
    try {
      // Pokušaj SELECT
      const [count] = await connection.execute(
        "SELECT COUNT(*) as total FROM P93597gsp"
      );
      console.log(`✅ Tabela P93597gsp POSTOJI!`);
      console.log(`   Ukupan broj redova: ${count[0].total}`);
      
      // Proveri podatke za danas
      const [todayCount] = await connection.execute(
        "SELECT COUNT(*) as today_total, MIN(captured) as first, MAX(captured) as last FROM P93597gsp WHERE DATE(captured) = CURDATE()"
      );
      
      console.log(`\n📊 Podaci za danas:`);
      console.log(`   - Broj redova: ${todayCount[0].today_total}`);
      if (todayCount[0].today_total > 0) {
        console.log(`   - Prvi zapis: ${todayCount[0].first}`);
        console.log(`   - Poslednji zapis: ${todayCount[0].last}`);
      }
      
      // Struktura tabele
      const [columns] = await connection.execute(
        "SHOW COLUMNS FROM P93597gsp"
      );
      
      console.log(`\n📋 Struktura tabele:`);
      columns.forEach(col => {
        console.log(`   - ${col.Field} (${col.Type})`);
      });
      
      // Sample podatak
      const [sample] = await connection.execute(
        "SELECT * FROM P93597gsp ORDER BY captured DESC LIMIT 1"
      );
      
      if (sample.length > 0) {
        console.log('\n📌 Najnoviji podatak:');
        console.log(JSON.stringify(sample[0], null, 2));
      }
      
    } catch (err) {
      console.log(`❌ Greška pri pristupu P93597gsp tabeli: ${err.message}`);
      
      // Pokušaj sa različitim varijantama
      const variants = ['P93597gsp', 'p93597gsp', 'P93597GPS', 'p93597GPS'];
      
      for (const variant of variants) {
        try {
          const [test] = await connection.execute(`SELECT 1 FROM \`${variant}\` LIMIT 1`);
          console.log(`✅ Pronađena varijanta: ${variant}`);
          break;
        } catch (e) {
          // Nastavi sa sledećom
        }
      }
    }
    
    // Proveri sve tabele koje sadrže 93597
    console.log('\n🔍 Sve tabele koje sadrže "93597":');
    const [tables93597] = await connection.execute(
      "SHOW TABLES LIKE '%93597%'"
    );
    
    if (tables93597.length > 0) {
      tables93597.forEach(t => {
        const tableName = Object.values(t)[0];
        console.log(`   - ${tableName}`);
      });
    } else {
      console.log('   Nema tabela koje sadrže "93597"');
    }

  } catch (error) {
    console.error('❌ Globalna greška:', error.message);
  } finally {
    if (connection) await connection.end();
    await prisma.$disconnect();
  }
}

console.log('🚀 Proveravam P93597gsp tabelu...\n');
checkP93597gsp().catch(console.error);