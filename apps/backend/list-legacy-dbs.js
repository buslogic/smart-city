const { PrismaClient } = require('@prisma/client');
const mysql = require('mysql2/promise');

const prisma = new PrismaClient();

async function checkAllDatabases() {
  try {
    // Dohvati sve legacy baze
    const legacyDbs = await prisma.legacyDatabase.findMany({
      where: {
        isActive: true
      }
    });

    console.log('=== SVE KONFIGURISANE LEGACY BAZE ===\n');
    
    for (const db of legacyDbs) {
      console.log(`📁 ${db.name}`);
      console.log(`   Type: ${db.type}`);
      console.log(`   Subtype: ${db.subtype || 'N/A'}`);
      console.log(`   Host: ${db.host}:${db.port}`);
      console.log(`   Database: ${db.database}`);
      console.log(`   Username: ${db.username}`);
      console.log(`   Active: ${db.isActive ? '✅' : '❌'}`);
      console.log(`   Last test: ${db.lastConnectionTest || 'Never'}`);
      
      // Pokušaj konekciju
      console.log(`   Testing connection...`);
      try {
        const connection = await mysql.createConnection({
          host: db.host,
          port: db.port,
          user: db.username,
          password: db.password,
          database: db.database,
          connectTimeout: 5000
        });
        
        // Proveri da li postoji current tabela
        const [tables] = await connection.execute(`
          SHOW TABLES LIKE 'current'
        `);
        
        if (tables.length > 0) {
          console.log(`   ✅ Connected! Has 'current' table`);
          
          // Prebroj zapise
          const [count] = await connection.execute(`
            SELECT COUNT(*) as total FROM current
          `);
          console.log(`   📊 Records in current: ${count[0].total}`);
        } else {
          console.log(`   ✅ Connected! No 'current' table`);
        }
        
        await connection.end();
      } catch (err) {
        console.log(`   ❌ Connection failed: ${err.message}`);
      }
      
      console.log('');
    }

  } catch (error) {
    console.error('Greška:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllDatabases();