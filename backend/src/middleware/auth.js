import ApiError from '../utils/ApiError.js';
import { verifyToken } from '../utils/jwt.js';

/** Pull "Authorization: Bearer <token>" off the request, if present. */
function readBearer(req) {
  const header = req.header('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

/** Hard requirement: 401 if there is no valid token. */
export function requireAuth(req, res, next) {
  const token = readBearer(req);
  if (!token) return next(ApiError.unauthorized('Missing Bearer token'));
  const payload = verifyToken(token);
  req.user = {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    tier: payload.tier,
    storeId: payload.storeId ?? null,
  };
  next();
}

/**
 * Soft auth: populates req.user when a token is present, never rejects.
 * Use on public endpoints that personalise their response (product list
 * showing tier pricing, RAG answers filtered by membership tier).
 */
export function optionalAuth(req, res, next) {
  const token = readBearer(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tier: payload.tier,
      storeId: payload.storeId ?? null,
    };
  } catch {
    // Ignore a bad token on a public route.
  }
  next();
}

/**
 * Role gate. Use after requireAuth:
 *   router.patch('/x', requireAuth, requireRole('STORE_MANAGER', 'ADMIN'), handler)
 */
export function requireRole(...roles) {
  return function roleGate(req, res, next) {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(`Requires role: ${roles.join(' or ')} (you are ${req.user.role})`)
      );
    }
    next();
  };
}

/**
 * A STORE_MANAGER may only touch the store they manage; ADMIN may touch any.
 * Expects the store id at req.params[paramName].
 */
export function requireStoreScope(paramName = 'storeId') {
  return function storeScope(req, res, next) {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'ADMIN') return next();
    const target = req.params[paramName];
    if (req.user.role === 'STORE_MANAGER' && req.user.storeId === target) return next();
    return next(ApiError.forbidden(`You are not a manager of store ${target}`));
  };
}
