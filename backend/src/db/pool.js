import pg from 'pg';
import env from '../config/env.js';

// Return NUMERIC as JS number instead of string so JSON responses are numeric.
// (Fine for prices/quantities at this scale; revisit if we ever need big money math.)
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: env.pgSsl ? { rejectUnauthorized: false } : false,
  max: env.pgPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('[db] idle client error', err.message);
});

/** Run a single query. */
export function query(text, params) {
  return pool.query(text, params);
}

/** Convenience: first row or null. */
export async function queryOne(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
}

/** Run a callback inside a transaction. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function healthCheck() {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}

export async function closePool() {
  await pool.end();
}
