import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import ApiError from './ApiError.js';

/**
 * Token payload kept deliberately small:
 *   sub   - user id
 *   email - login email
 *   role  - CUSTOMER | STORE_MANAGER | ADMIN
 *   tier  - STANDARD | SILVER | GOLD | PLATINUM (used by RAG metadata filters)
 *   storeId - store a STORE_MANAGER is scoped to (null otherwise)
 */
export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tier: user.membership_tier,
      storeId: user.managed_store_id ?? null,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn, issuer: 'retailpulse-ai' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret, { issuer: 'retailpulse-ai' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Token expired, please log in again');
    }
    throw ApiError.unauthorized('Invalid token');
  }
}
