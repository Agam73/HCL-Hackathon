#!/usr/bin/env node
/**
 * Loads db/seed/*.csv into the database. Idempotent - every insert is an
 * UPSERT, so running it twice is safe and running it after editing a CSV
 * just updates the rows.
 *
 * products.csv / inventory.csv are hand-written; products_generated.csv /
 * inventory_generated.csv come from `npm run db:generate` and are loaded too.
 *
 *   npm run db:seed
 *
 * Users: the CSV "password" column may be blank, in which case
 * SEED_DEFAULT_PASSWORD from .env is used (default "Passw0rd!").
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { pool, closePool } from '../src/db/pool.js';
import { hashPassword } from '../src/utils/password.js';
import env from '../src/config/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.join(here, '..', 'db', 'seed');

async function readCsv(file) {
  const text = await readFile(path.join(seedDir, file), 'utf8');
  return parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true });
}

/** Rows of several CSVs concatenated; files that do not exist are skipped. */
async function readCsvs(...files) {
  const present = files.filter((file) => existsSync(path.join(seedDir, file)));
  return (await Promise.all(present.map(readCsv))).flat();
}

const nullIfBlank = (v) => (v === undefined || v === '' ? null : v);
const num = (v) => (v === undefined || v === '' ? null : Number(v));
const bool = (v) => String(v).toLowerCase() === 'true' || v === '1';

async function seedBrands(client) {
  const rows = await readCsv('brands.csv');
  for (const r of rows) {
    await client.query(
      `INSERT INTO brands (id, name, slug, logo_url) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name, slug = EXCLUDED.slug, logo_url = EXCLUDED.logo_url`,
      [r.id, r.name, r.slug, nullIfBlank(r.logo_url)]
    );
  }
  return rows.length;
}

async function seedCategories(client) {
  const rows = await readCsv('categories.csv');
  // Parents first so the self-referencing FK is always satisfiable.
  const ordered = [...rows].sort((a, b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0));
  for (const r of ordered) {
    await client.query(
      `INSERT INTO categories (id, name, slug, parent_id, sort_order) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name, slug = EXCLUDED.slug,
             parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order`,
      [r.id, r.name, r.slug, nullIfBlank(r.parent_id), num(r.sort_order) ?? 0]
    );
  }
  return rows.length;
}

async function seedProducts(client) {
  const rows = await readCsvs('products.csv', 'products_generated.csv');
  for (const r of rows) {
    const images = r.images ? r.images.split('|').filter(Boolean) : [];
    await client.query(
      `INSERT INTO products
         (id, name, slug, description, keywords, category_id, brand_id, price, mrp,
          currency, specifications, images, rating, rating_count, warranty_months, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::text[],$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, slug = EXCLUDED.slug, description = EXCLUDED.description,
         keywords = EXCLUDED.keywords, category_id = EXCLUDED.category_id,
         brand_id = EXCLUDED.brand_id, price = EXCLUDED.price, mrp = EXCLUDED.mrp,
         currency = EXCLUDED.currency, specifications = EXCLUDED.specifications,
         images = EXCLUDED.images, rating = EXCLUDED.rating,
         rating_count = EXCLUDED.rating_count, warranty_months = EXCLUDED.warranty_months,
         is_active = EXCLUDED.is_active`,
      [
        r.id, r.name, r.slug, nullIfBlank(r.description), nullIfBlank(r.keywords),
        r.category_id, r.brand_id, num(r.price), num(r.mrp), r.currency || 'INR',
        r.specifications || '{}', images, num(r.rating) ?? 0, num(r.rating_count) ?? 0,
        num(r.warranty_months), r.is_active === undefined ? true : bool(r.is_active),
      ]
    );
  }
  return rows.length;
}

async function seedStores(client) {
  const rows = await readCsv('stores.csv');
  for (const r of rows) {
    await client.query(
      `INSERT INTO stores
         (id, name, type, address_line, city, state, country, postal_code,
          latitude, longitude, phone, opens_at, closes_at)
       VALUES ($1,$2,$3::store_type,$4,$5,$6,$7,$8,$9,$10,$11,$12::time,$13::time)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, type = EXCLUDED.type, address_line = EXCLUDED.address_line,
         city = EXCLUDED.city, state = EXCLUDED.state, country = EXCLUDED.country,
         postal_code = EXCLUDED.postal_code, latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude, phone = EXCLUDED.phone,
         opens_at = EXCLUDED.opens_at, closes_at = EXCLUDED.closes_at`,
      [
        r.id, r.name, r.type || 'STORE', nullIfBlank(r.address_line), r.city,
        nullIfBlank(r.state), r.country || 'IN', nullIfBlank(r.postal_code),
        num(r.latitude), num(r.longitude), nullIfBlank(r.phone),
        nullIfBlank(r.opens_at), nullIfBlank(r.closes_at),
      ]
    );
  }
  return rows.length;
}

async function seedInventory(client) {
  const rows = await readCsvs('inventory.csv', 'inventory_generated.csv');
  // One statement for all rows: thousands of round trips are slow on a hosted database.
  await client.query(
    `INSERT INTO inventory
       (store_id, product_id, quantity_available, quantity_reserved, reorder_level, last_synced_at)
     SELECT t.store_id, t.product_id, t.available, t.reserved, t.reorder, now()
       FROM unnest($1::text[], $2::text[], $3::int[], $4::int[], $5::int[])
            AS t(store_id, product_id, available, reserved, reorder)
     ON CONFLICT (store_id, product_id) DO UPDATE SET
       quantity_available = EXCLUDED.quantity_available,
       quantity_reserved  = EXCLUDED.quantity_reserved,
       reorder_level      = EXCLUDED.reorder_level,
       last_synced_at     = now()`,
    [
      rows.map((r) => r.store_id),
      rows.map((r) => r.product_id),
      rows.map((r) => num(r.quantity_available) ?? 0),
      rows.map((r) => num(r.quantity_reserved) ?? 0),
      rows.map((r) => num(r.reorder_level) ?? 5),
    ]
  );
  return rows.length;
}

async function seedUsers(client) {
  const rows = await readCsv('customers.csv');
  // One bcrypt hash for the shared default password instead of N hashes.
  const defaultHash = await hashPassword(env.seedDefaultPassword);

  for (const r of rows) {
    const hash = r.password ? await hashPassword(r.password) : defaultHash;
    await client.query(
      `INSERT INTO users
         (email, password_hash, full_name, phone, role, membership_tier,
          city, country, preferred_store_id, managed_store_id, preferences)
       VALUES ($1,$2,$3,$4,$5::user_role,$6::membership_tier,$7,$8,$9,$10,$11::jsonb)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone, role = EXCLUDED.role,
         membership_tier = EXCLUDED.membership_tier, city = EXCLUDED.city,
         country = EXCLUDED.country, preferred_store_id = EXCLUDED.preferred_store_id,
         managed_store_id = EXCLUDED.managed_store_id, preferences = EXCLUDED.preferences`,
      [
        r.email.toLowerCase(), hash, r.full_name, nullIfBlank(r.phone),
        r.role || 'CUSTOMER', r.membership_tier || 'STANDARD', nullIfBlank(r.city),
        r.country || 'IN', nullIfBlank(r.preferred_store_id),
        nullIfBlank(r.managed_store_id), r.preferences || '{}',
      ]
    );
  }
  return rows.length;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Order matters: referenced tables first.
    const counts = {
      brands: await seedBrands(client),
      categories: await seedCategories(client),
      products: await seedProducts(client),
      stores: await seedStores(client),
      inventory: await seedInventory(client),
      users: await seedUsers(client),
    };

    await client.query('COMMIT');

    for (const [table, n] of Object.entries(counts)) {
      console.log(`[seed] ${table.padEnd(11)} ${n}`);
    }
    console.log(`[seed] done. every seeded user's password is "${env.seedDefaultPassword}"`);
    console.log('[seed] try:  admin@novamart.com | manager.del01@novamart.com | ishaan.gupta@example.com');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await closePool();
  }
}

main().catch((err) => {
  console.error('[seed] error:', err.message);
  if (err.detail) console.error('[seed] detail:', err.detail);
  process.exit(1);
});
