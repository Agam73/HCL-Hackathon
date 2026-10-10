import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import asyncHandler from '../../utils/asyncHandler.js';
import validate from '../../middleware/validate.js';
import { requireAuth, optionalAuth, requireRole } from '../../middleware/auth.js';
import { ok, created, noContent } from '../../utils/response.js';
import * as authService from './auth.service.js';
import {
  registerBody,
  loginBody,
  refreshBody,
  createStaffBody,
  updateMeBody,
} from './auth.schema.js';

const router = Router();

// Keep credential-stuffing out of the demo without annoying real usage.
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again shortly' } },
});

/** POST /auth/register - customer self-signup, returns a token immediately. */
router.post(
  '/register',
  authLimiter,
  validate({ body: registerBody }),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    return created(res, result);
  })
);

/** POST /auth/login -> { user, token, refreshToken } */
router.post(
  '/login',
  authLimiter,
  validate({ body: loginBody }),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    return ok(res, result);
  })
);

/** POST /auth/refresh -> { user, token, refreshToken } (the old refresh token stops working). */
router.post(
  '/refresh',
  authLimiter,
  validate({ body: refreshBody }),
  asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.body);
    return ok(res, result);
  })
);

/**
 * POST /auth/admin-device -> { user, token, refreshToken } for a locked admin PC.
 * No credentials: the caller is identified by network address (ADMIN_TRUSTED_IPS).
 * The socket address is used, not req.ip, so an X-Forwarded-For header cannot fake it.
 */
router.post(
  '/admin-device',
  authLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const result = await authService.adminDeviceSession({
      ip: req.socket.remoteAddress,
      currentUser: req.user,
    });
    return ok(res, result);
  })
);

/** POST /auth/logout - revokes the refresh token. */
router.post(
  '/logout',
  validate({ body: refreshBody }),
  asyncHandler(async (req, res) => {
    await authService.logout(req.body);
    return noContent(res);
  })
);

/** GET /auth/me - current user from the Bearer token. */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.getById(req.user.id);
    return ok(res, user);
  })
);

/** PATCH /auth/me - update profile + preferences (preferences are merged). */
router.patch(
  '/me',
  requireAuth,
  validate({ body: updateMeBody }),
  asyncHandler(async (req, res) => {
    const user = await authService.updateMe(req.user.id, req.body);
    return ok(res, user);
  })
);

/** POST /auth/staff - ADMIN creates STORE_MANAGER / ADMIN accounts. */
router.post(
  '/staff',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createStaffBody }),
  asyncHandler(async (req, res) => {
    const user = await authService.createStaff(req.body);
    return created(res, user);
  })
);

export default router;
