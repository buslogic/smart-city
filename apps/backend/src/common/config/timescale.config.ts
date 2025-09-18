import { Pool } from 'pg';

/**
 * Kreira PostgreSQL/TimescaleDB connection pool
 * Koristi TIMESCALE_DATABASE_URL ako postoji, inače fallback na pojedinačne varijable
 */
export function createTimescalePool(): Pool {
  // Prioritet 1: Koristi connection string ako postoji
  if (process.env.TIMESCALE_DATABASE_URL) {
    return new Pool({
      connectionString: process.env.TIMESCALE_DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  // Prioritet 2: Fallback na pojedinačne environment varijable
  // Baci grešku ako nisu postavljene kredencijali
  if (!process.env.TIMESCALE_HOST || !process.env.TIMESCALE_PASSWORD) {
    throw new Error(
      'TimescaleDB connection parameters are not properly configured. Please set TIMESCALE_DATABASE_URL or individual TIMESCALE_* environment variables.',
    );
  }

  return new Pool({
    host: process.env.TIMESCALE_HOST,
    port: parseInt(process.env.TIMESCALE_PORT || '5432'),
    database: process.env.TIMESCALE_DB || 'tsdb',
    user: process.env.TIMESCALE_USER || 'tsdbadmin',
    password: process.env.TIMESCALE_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

/**
 * Testira konekciju na TimescaleDB
 */
export async function testTimescaleConnection(pool: Pool): Promise<boolean> {
  try {
    const result = await pool.query('SELECT version()');
    // Verbose logging disabled - connection successful
    return true;
  } catch (error) {
    console.error('❌ TimescaleDB konekcija neuspešna:', error);
    return false;
  }
}
