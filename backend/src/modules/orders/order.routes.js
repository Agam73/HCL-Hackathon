import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';
import validate from '../../middleware/validate.js';
import { requireAuth, requireRole, requireStoreScope } from '../../middleware/auth.js';
import { ok, created, paged } from '../../utils/response.js';
import { storeIdParam } from '../../utils/schemas.js';
import * as orders from './order.service.js';
import {
  placeOrderBody,
  listOrdersQuery,
  orderRefParam,
  updateStatusBody,
} from './order.schema.js';

const router = Router();
router.use(requireAuth);

/**
 * POST /orders - check out the cart (pickup or delivery, simulated payment).
 * Send an Idempotency-Key header (or idempotencyKey in the body) to make retries
 * safe: the same key returns the original order with 200 instead of a new 201.
 */
router.post(
  '/',
  validate({ body: placeOrderBody }),
  asyncHandler(async (req, res) => {
    const headerKey = req.header('idempotency-key')?.trim();
    const idempotencyKey = req.body.idempotencyKey ?? (headerKey || undefined);
    if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 128)) {
      throw ApiError.unprocessable('Request validation failed', [
        { field: 'Idempotency-Key', message: 'Must be 8 to 128 characters' },
      ]);
    }
    const { order, replayed } = await orders.placeOrder(req.user, { ...req.body, idempotencyKey });
    return replayed ? ok(res, order) : created(res, order);
  })
);

/** GET /orders - the caller's order history. */
router.get(
  '/',
  validate({ query: listOrdersQuery }),
  asyncHandler(async (req, res) => {
    const { items, totalItems } = await orders.listMyOrders(req.user.id, req.query);
    return paged(res, items, { page: req.query.page, size: req.query.size, totalItems });
  })
);

/** GET /orders/:orderRef - by id or order number; owner, store manager or ADMIN. */
router.get(
  '/:orderRef',
  validate({ params: orderRefParam }),
  asyncHandler(async (req, res) => ok(res, await orders.getOrder(req.params.orderRef, req.user)))
);

/** POST /orders/:orderRef/cancel - the customer cancels; stock goes back. */
router.post(
  '/:orderRef/cancel',
  validate({ params: orderRefParam }),
  asyncHandler(async (req, res) => ok(res, await orders.cancelOrder(req.params.orderRef, req.user)))
);

/** PATCH /orders/:orderRef/status - STORE_MANAGER (own store) or ADMIN. */
router.patch(
  '/:orderRef/status',
  requireRole('STORE_MANAGER', 'ADMIN'),
  validate({ params: orderRefParam, body: updateStatusBody }),
  asyncHandler(async (req, res) =>
    ok(res, await orders.updateStatus(req.params.orderRef, req.user, req.body.status))
  )
);

export default router;

/** Mounted at /stores/:storeId/orders - the store's fulfilment queue. */
export const storeOrdersRouter = Router({ mergeParams: true }).get(
  '/',
  requireAuth,
  requireRole('STORE_MANAGER', 'ADMIN'),
  requireStoreScope('storeId'),
  validate({ params: storeIdParam, query: listOrdersQuery }),
  asyncHandler(async (req, res) => {
    const { items, totalItems } = await orders.listStoreOrders(req.params.storeId, req.query);
    return paged(res, items, { page: req.query.page, size: req.query.size, totalItems });
  })
);
