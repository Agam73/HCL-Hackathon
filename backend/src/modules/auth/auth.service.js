import { query, queryOne } from '../../db/pool.js';
import ApiError from '../../utils/ApiError.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { signToken } from '../../utils/jwt.js';

const PUBLIC_COLUMNS = `
  id, email, full_name, phone, role, membership_tier, city, country,
  preferred_store_id, managed_store_id, preferences, is_active,
  last_login_at, created_at
`;

/** Shape a DB row into the JSON the frontend consumes (camelCase). */
export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    membershipTier: row.membership_tier,
    city: row.city,
    country: row.country,
    preferredStoreId: row.preferred_store_id,
    managedStoreId: row.managed_store_id,
    preferences: row.preferences ?? {},
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

async function insertUser(input, role) {
  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [input.email]);
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const passwordHash = await hashPassword(input.password);

  const row = await queryOne(
    `INSERT INTO users
       (email, password_hash, full_name, phone, role, membership_tier,
        city, country, preferred_store_id, managed_store_id, preferences)
     VALUES ($1,$2,$3,$4,$5::user_role,$6::membership_tier,$7,$8,$9,$10,$11::jsonb)
     RETURNING ${PUBLIC_COLUMNS}`,
    [
      input.email,
      passwordHash,
      input.fullName,
      input.phone ?? null,
      role,
      input.membershipTier ?? 'STANDARD',
      input.city ?? null,
      input.country ?? 'IN',
      input.preferredStoreId ?? null,
      role === 'STORE_MANAGER' ? input.managedStoreId ?? null : null,
      JSON.stringify(input.preferences ?? {}),
    ]
  );

  return row;
}

/** Public self-signup - always creates a CUSTOMER, never staff. */
export async function register(input) {
  const row = await insertUser(input, 'CUSTOMER');
  return { user: toPublicUser(row), token: signToken(row) };
}

/** ADMIN-only staff creation. */
export async function createStaff(input) {
  if (input.role === 'STORE_MANAGER' && !input.managedStoreId) {
    throw ApiError.badRequest('managedStoreId is required for a STORE_MANAGER');
  }
  const row = await insertUser(input, input.role);
  return toPublicUser(row);
}

export async function login({ email, password }) {
  const row = await queryOne(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = $1`,
    [email]
  );

  // Same message for unknown email and wrong password - no account enumeration.
  if (!row) throw ApiError.unauthorized('Invalid email or password');
  if (!row.is_active) throw ApiError.forbidden('This account is disabled');

  const matches = await comparePassword(password, row.password_hash);
  if (!matches) throw ApiError.unauthorized('Invalid email or password');

  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [row.id]);

  return { user: toPublicUser(row), token: signToken(row) };
}

export async function getById(id) {
  const row = await queryOne(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  if (!row) throw ApiError.notFound('User');
  return toPublicUser(row);
}

export async function updateMe(id, patch) {
  const sets = [];
  const params = [];
  const push = (sql, value) => {
    params.push(value);
    sets.push(`${sql} = $${params.length}`);
  };

  if (patch.fullName !== undefined) push('full_name', patch.fullName);
  if (patch.phone !== undefined) push('phone', patch.phone);
  if (patch.city !== undefined) push('city', patch.city);
  if (patch.preferredStoreId !== undefined) push('preferred_store_id', patch.preferredStoreId);
  if (patch.preferences !== undefined) {
    // Merge rather than replace so partial preference updates are safe.
    params.push(JSON.stringify(patch.preferences));
    sets.push(`preferences = preferences || $${params.length}::jsonb`);
  }

  params.push(id);
  const row = await queryOne(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING ${PUBLIC_COLUMNS}`,
    params
  );
  if (!row) throw ApiError.notFound('User');
  return toPublicUser(row);
}
