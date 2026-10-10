import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import asyncHandler from '../../utils/asyncHandler.js';
import validate from '../../middleware/validate.js';
import { optionalAuth } from '../../middleware/auth.js';
import { ok } from '../../utils/response.js';
import { recommend } from './assistant.service.js';
import { recommendBody } from './assistant.schema.js';

const router = Router();

// Model calls cost money and time; keep any one client from hammering them.
const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many assistant requests, try again shortly' },
  },
});

/**
 * POST /assistant/recommendations { query, storeId?, limit? }
 * -> { interpretedRequirement, recommendations[], clarifyingQuestion, meta }
 * Public; a signed-in customer's preferred store, tier and preferences are used when present.
 */
router.post(
  '/recommendations',
  aiLimiter,
  optionalAuth,
  validate({ body: recommendBody }),
  asyncHandler(async (req, res) =>
    ok(res, await recommend(req.body, { user: req.user ?? null, traceId: req.traceId }))
  )
);

export default router;
