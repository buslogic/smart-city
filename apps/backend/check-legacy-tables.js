const mysql = require('mysql2/promise');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Dekriptovanje passworda
function decryptPassword(encryptedPassword) {
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

async function checkTables() {
  let connection;
  
  try {
    // Dohvati kredencijale iz baze
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

    console.log('Konfiguracija:');
    console.log(`  Host: ${legacyDb.host}`);
    console.log(`  Port: ${legacyDb.port}`);
    console.log(`  Database: ${legacyDb.database}`);
    console.log(`  Username: ${legacyDb.username}`);

    const password = decryptPassword(legacyDb.password);
    
    // Konektuj se
    console.log('\n🔗 Povezujem se na legacy bazu...');
    connection = await mysql.createConnection({
      host: legacyDb.host,
      port: legacyDb.port,
      user: legacyDb.username,
      password: password,
      database: legacyDb.database,
      connectTimeout: 30000,
    });

    console.log('✅ Uspešno povezan!\n');

    // Proveri sve tabele
    console.log('📊 Lista svih tabela u bazi:');
    const [tables] = await connection.execute('SHOW TABLES');
    
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`  ${index + 1}. ${tableName}`);
    });

    // Proveri tabele koje sadrže '93597'
    console.log('\n🔍 Tabele koje sadrže "93597":');
    const [filteredTables] = await connection.execute(
      "SHOW TABLES LIKE '%93597%'"
    );
    
    if (filteredTables.length > 0) {
      for (const table of filteredTables) {
        const tableName = Object.values(table)[0];
        console.log(`\n  📌 ${tableName}`);
        
        // Proveri strukturu tabele
        const [columns] = await connection.execute(
          `SHOW COLUMNS FROM \`${tableName}\``
        );
        
        console.log('     Kolone:');
        columns.forEach(col => {
          console.log(`       - ${col.Field} (${col.Type})`);
        });
        
        // Broj redova
        const [count] = await connection.execute(
          `SELECT COUNT(*) as total FROM \`${tableName}\``
        );
        console.log(`     Ukupno redova: ${count[0].total}`);
      }
    } else {
      console.log('  ❌ Nema tabela koje sadrže "93597"');
    }

    // Proveri specifično P93597gsp
    console.log('\n🔍 Provera P93597gsp tabele:');
    try {
      const [result] = await connection.execute(
        "SELECT COUNT(*) as cnt FROM `P93597gsp`"
      );
      console.log(`  ✅ Tabela P93597gsp postoji sa ${result[0].cnt} redova`);
    } catch (err) {
      console.log(`  ❌ Tabela P93597gsp ne postoji: ${err.message}`);
    }

  } catch (error) {
    console.error('❌ Greška:', error.message);
  } finally {
    if (connection) await connection.end();
    await prisma.$disconnect();
  }
}

console.log('🚀 Provera tabela u legacy bazi...\n');
console.log('=' .repeat(60));
checkTables().catch(console.error);