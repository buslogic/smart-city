import * as mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Dekriptovanje passworda (ista logika kao u LegacyDatabasesService)
function decryptPassword(encryptedPassword: string): string {
  try {
    const parts = encryptedPassword.split(':');
    if (parts.length !== 2) {
      // Ako nije u očekivanom formatu, pretpostavi da je već plain text
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
    // Ako dekriptovanje ne uspe, pretpostavi da je već plain text
    console.log('⚠️ Dekriptovanje nije uspelo, koristi se plain text');
    return encryptedPassword;
  }
}

async function exploreGPSTables() {
  let connection: mysql.Connection | null = null;

  try {
    // Dohvati kredencijale za GPS bazu
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

    console.log('Povezujem se na legacy GPS bazu...');
    console.log(`Host: ${legacyDb.host}:${legacyDb.port}`);
    console.log(`Database: ${legacyDb.database}`);

    // Kreiraj konekciju
    connection = await mysql.createConnection({
      host: legacyDb.host,
      port: legacyDb.port,
      user: legacyDb.username,
      password: password,
      database: legacyDb.database,
      connectTimeout: 30000,
    });

    console.log('✅ Uspešno povezan na legacy GPS bazu\n');

    // 1. Pronađi sve tabele koje se završavaju sa 'gps'
    console.log('📋 Tražim tabele sa GPS podacima...\n');

    const [tables] = await connection.execute(
      `
      SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, CREATE_TIME
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME LIKE '%gps'
      ORDER BY TABLE_NAME
      LIMIT 10
    `,
      [legacyDb.database],
    );

    console.log(`Pronađeno ${(tables as any[]).length} GPS tabela:\n`);

    (tables as any[]).forEach((table) => {
      const sizeInMB = (table.DATA_LENGTH / 1024 / 1024).toFixed(2);
      console.log(
        `  - ${table.TABLE_NAME}: ${table.TABLE_ROWS} redova, ${sizeInMB} MB`,
      );
    });

    // 2. Uzmi prvu tabelu kao primer i analiziraj strukturu
    if ((tables as any[]).length > 0) {
      const exampleTable = (tables as any[])[0].TABLE_NAME;
      console.log(`\n📊 Analiziram strukturu tabele: ${exampleTable}\n`);

      // Dohvati strukturu kolona
      const [columns] = await connection.execute(
        `
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          CHARACTER_MAXIMUM_LENGTH,
          NUMERIC_PRECISION,
          NUMERIC_SCALE,
          COLUMN_COMMENT
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `,
        [legacyDb.database, exampleTable],
      );

      console.log('Struktura tabele:\n');
      console.log(
        'Kolona                | Tip            | Nullable | Default | Komentar',
      );
      console.log(
        '----------------------|----------------|----------|---------|----------',
      );

      (columns as any[]).forEach((col) => {
        let type = col.DATA_TYPE;
        if (col.CHARACTER_MAXIMUM_LENGTH) {
          type += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
        } else if (col.NUMERIC_PRECISION) {
          type += `(${col.NUMERIC_PRECISION}`;
          if (col.NUMERIC_SCALE) {
            type += `,${col.NUMERIC_SCALE}`;
          }
          type += ')';
        }

        const nullable = col.IS_NULLABLE === 'YES' ? 'YES' : 'NO';
        const defaultVal = col.COLUMN_DEFAULT || '-';
        const comment = col.COLUMN_COMMENT || '-';

        console.log(
          `${col.COLUMN_NAME.padEnd(21)} | ${type.padEnd(14)} | ${nullable.padEnd(8)} | ${defaultVal.toString().padEnd(7).substring(0, 7)} | ${comment}`,
        );
      });

      // 3. Dohvati nekoliko primera podataka
      console.log(
        `\n📋 Primeri podataka iz ${exampleTable} (poslednji unosi):\n`,
      );

      const [sampleData] = await connection.execute(`
        SELECT * FROM ${exampleTable}
        ORDER BY edited DESC
        LIMIT 3
      `);

      if ((sampleData as any[]).length > 0) {
        console.log('Prvi red (JSON format):');
        console.log(JSON.stringify((sampleData as any[])[0], null, 2));
      }

      // 4. Proveri indekse
      const [indexes] = await connection.execute(`
        SHOW INDEXES FROM ${exampleTable}
      `);

      console.log(`\n🔍 Indeksi na tabeli ${exampleTable}:\n`);
      const uniqueIndexes = new Set();
      (indexes as any[]).forEach((idx) => {
        uniqueIndexes.add(`${idx.Key_name} (${idx.Column_name})`);
      });
      uniqueIndexes.forEach((idx) => console.log(`  - ${idx}`));

      // 5. Proveri datum range podataka
      console.log(`\n📅 Datum opseg podataka:\n`);

      const [dateRange] = await connection.execute(`
        SELECT 
          MIN(captured) as oldest_record,
          MAX(captured) as newest_record,
          COUNT(*) as total_records,
          COUNT(DISTINCT DATE(captured)) as distinct_days
        FROM ${exampleTable}
      `);

      const range = (dateRange as any[])[0];
      console.log(`  Najstariji zapis: ${range.oldest_record}`);
      console.log(`  Najnoviji zapis: ${range.newest_record}`);
      console.log(`  Ukupno zapisa: ${range.total_records}`);
      console.log(`  Broj različitih dana: ${range.distinct_days}`);
    }

    // 6. Proveri current tabelu takođe
    console.log('\n📋 Analiza CURRENT tabele:\n');

    const [currentColumns] = await connection.execute(
      `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'current'
      ORDER BY ORDINAL_POSITION
    `,
      [legacyDb.database],
    );

    console.log('Kolone u current tabeli:');
    (currentColumns as any[]).forEach((col) => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
    });
  } catch (error) {
    console.error('❌ Greška:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    await prisma.$disconnect();
  }
}

// Pokreni skript
exploreGPSTables().catch(console.error);
