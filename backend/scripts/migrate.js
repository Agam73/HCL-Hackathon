#!/usr/bin/env node
/**
 * Runs every db/migrations/*.sql in filename order, once each, inside a
 * transaction, and records what ran in schema_migrations.
 *
 *   npm run db:migrate            apply pending migrations
 *   npm run db:migrate -- --reset DROP the public schema first, then apply all
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from '../src/db/pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, '..', 'db', 'migrations');

async function main() {
  const reset = process.argv.includes('--reset');
  const client = await pool.connect();

  try {
    if (reset) {
      console.warn('[migrate] --reset: dropping schema public');
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
    let ran = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] skip    ${file}`);
        continue;
      }
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      console.log(`[migrate] apply   ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        ran += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] FAILED  ${file}: ${err.message}`);
        throw err;
      }
    }

    console.log(`[migrate] done - ${ran} migration(s) applied, ${files.length} total`);
  } finally {
    client.release();
    await closePool();
  }
}

main().catch((err) => {
  console.error('[migrate] error:', err.message);
  process.exit(1);
});
