import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import asyncHandler from '../../utils/asyncHandler.js';
import validate from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { ok, created } from '../../utils/response.js';
import * as authService from './auth.service.js';
import { registerBody, loginBody, createStaffBody, updateMeBody } from './auth.schema.js';

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

/** POST /auth/login -> { user, token } */
router.post(
  '/login',
  authLimiter,
  validate({ body: loginBody }),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    return ok(res, result);
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
