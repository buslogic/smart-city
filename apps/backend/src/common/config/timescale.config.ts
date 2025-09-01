import { Pool } from 'pg';

/**
 * Kreira PostgreSQL/TimescaleDB connection pool
 * Koristi TIMESCALE_DATABASE_URL ako postoji, inače fallback na pojedinačne varijable
 */
export function createTimescalePool(): Pool {
  // Prioritet 1: Koristi connection string ako postoji
  if (process.env.TIMESCALE_DATABASE_URL) {
    console.log('📊 Koristi se TIMESCALE_DATABASE_URL za TimescaleDB konekciju');
    return new Pool({
      connectionString: process.env.TIMESCALE_DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  // Prioritet 2: Fallback na pojedinačne environment varijable
  console.log('📊 Koriste se pojedinačne environment varijable za TimescaleDB');
  return new Pool({
    host: process.env.TIMESCALE_HOST || 'localhost',
    port: parseInt(process.env.TIMESCALE_PORT || '5433'),
    database: process.env.TIMESCALE_DB || 'smartcity_gps',
    user: process.env.TIMESCALE_USER || 'smartcity_ts',
    password: process.env.TIMESCALE_PASSWORD || 'TimescalePass123!',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

/**
 * Testira konekciju na TimescaleDB
 */
export async function testTimescaleConnection(pool: Pool): Promise<boolean> {
  try {
    const result = await pool.query('SELECT version()');
    console.log('✅ TimescaleDB konekcija uspešna:', result.rows[0].version);
    return true;
  } catch (error) {
    console.error('❌ TimescaleDB konekcija neuspešna:', error);
    return false;
  }
}