/**
 * Shared plumbing for the integration tests: the real Express app through
 * supertest, against the migrated + seeded database.
 */
import request from 'supertest';
import { createApp } from '../src/app.js';
import env from '../src/config/env.js';
import { pool } from '../src/db/pool.js';

export const api = request(createApp());
export const url = (path) => `${env.apiPrefix}${path}`;
export const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** Log in as a seeded account (all share SEED_DEFAULT_PASSWORD). */
export async function login(email, password = env.seedDefaultPassword) {
  const res = await api.post(url('/auth/login')).send({ email, password });
  if (res.status !== 200) throw new Error(`login ${email} -> ${res.status}`);
  return res.body.data;
}

/** A throwaway customer; remove it with deleteCustomer in afterAll. */
export async function registerCustomer(label, extra = {}) {
  const email = `jest.${label}.${Date.now()}@example.test`;
  const res = await api
    .post(url('/auth/register'))
    .send({ email, password: 'Sup3rSecret!', fullName: `Jest ${label}`, ...extra });
  if (res.status !== 201) throw new Error(`register -> ${res.status} ${JSON.stringify(res.body)}`);
  return { email, ...res.body.data };
}

/** Orders block deleting a user or product (ON DELETE RESTRICT), so they go first. */
export async function deleteCustomer(email) {
  await pool.query('DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [
    email,
  ]);
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
}

/** A product that exists only for one test file, with the stock you ask for. */
export async function createTestProduct(id, { price = 1000, mrp = 1200, stock = {} } = {}) {
  await pool.query(
    `INSERT INTO products (id, name, slug, category_id, brand_id, price, mrp)
     VALUES ($1, $2, $3, 'C0204', 'B12', $4, $5)`,
    [id, `Jest Product ${id}`, `jest-product-${id.toLowerCase()}`, price, mrp]
  );
  for (const [storeId, quantity] of Object.entries(stock)) {
    await pool.query(
      `INSERT INTO inventory (store_id, product_id, quantity_available, reorder_level)
       VALUES ($1, $2, $3, 2)`,
      [storeId, id, quantity]
    );
  }
}

export async function deleteTestProduct(id) {
  await pool.query('DELETE FROM order_items WHERE product_id = $1', [id]);
  await pool.query('DELETE FROM products WHERE id = $1', [id]);
}

export async function stockOf(storeId, productId) {
  const { rows } = await pool.query(
    'SELECT quantity_available FROM inventory WHERE store_id = $1 AND product_id = $2',
    [storeId, productId]
  );
  return rows[0]?.quantity_available ?? null;
}

export { env, pool };
