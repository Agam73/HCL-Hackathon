import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import validate from '../../middleware/validate.js';
import { requireAuth, requireRole, requireStoreScope } from '../../middleware/auth.js';
import { ok, paged } from '../../utils/response.js';
import { storeIdParam, storeProductParams, pageQuery } from '../../utils/schemas.js';
import { z } from 'zod';
import * as inventory from './inventory.service.js';
import {
  storeInventoryQuery,
  upsertInventoryBody,
  listMovementsQuery,
} from './inventory.schema.js';
import { listMovements } from './inventory.movements.js';

/**
 * Mounted at /stores/:storeId/inventory (mergeParams gives us :storeId).
 */
export const storeInventoryRouter = Router({ mergeParams: true });

/** GET /stores/:storeId/inventory - public: customers check availability. */
storeInventoryRouter.get(
  '/',
  validate({ params: storeIdParam, query: storeInventoryQuery }),
  asyncHandler(async (req, res) => {
    const { items, totalItems } = await inventory.listStoreInventory(
      req.params.storeId,
      req.query
    );
    return paged(res, items, { page: req.query.page, size: req.query.size, totalItems });
  })
);

/** GET /stores/:storeId/inventory/low-stock - STORE_MANAGER (own store) or ADMIN. */
storeInventoryRouter.get(
  '/low-stock',
  requireAuth,
  requireRole('STORE_MANAGER', 'ADMIN'),
  requireStoreScope('storeId'),
  validate({ params: storeIdParam, query: z.object({ ...pageQuery }) }),
  asyncHandler(async (req, res) => {
    const { items, totalItems } = await inventory.listLowStock(req.params.storeId, req.query);
    return paged(res, items, { page: req.query.page, size: req.query.size, totalItems });
  })
);

/**
 * GET /stores/:storeId/inventory/movements?productId=&type= - the stock ledger:
 * every restock, sale, return and adjustment. STORE_MANAGER (own store) or ADMIN.
 */
storeInventoryRouter.get(
  '/movements',
  requireAuth,
  requireRole('STORE_MANAGER', 'ADMIN'),
  requireStoreScope('storeId'),
  validate({ params: storeIdParam, query: listMovementsQuery }),
  asyncHandler(async (req, res) => {
    const { items, totalItems } = await listMovements(req.params.storeId, req.query);
    return paged(res, items, { page: req.query.page, size: req.query.size, totalItems });
  })
);

/** GET /stores/:storeId/inventory/:productId */
storeInventoryRouter.get(
  '/:productId',
  validate({ params: storeProductParams }),
  asyncHandler(async (req, res) => {
    const row = await inventory.getStoreProductInventory(
      req.params.storeId,
      req.params.productId
    );
    return ok(res, row);
  })
);

/**
 * PATCH /stores/:storeId/inventory/:productId
 * Body: { quantityAvailable } | { delta } | { reorderLevel }, optional { reason }
 * STORE_MANAGER may only change their own store; ADMIN may change any.
 */
storeInventoryRouter.patch(
  '/:productId',
  requireAuth,
  requireRole('STORE_MANAGER', 'ADMIN'),
  requireStoreScope('storeId'),
  validate({ params: storeProductParams, body: upsertInventoryBody }),
  asyncHandler(async (req, res) => {
    const result = await inventory.upsertStoreInventory(
      req.params.storeId,
      req.params.productId,
      req.body,
      { traceId: req.traceId, userId: req.user.id }
    );
    return ok(res, result);
  })
);

/**
 * Mounted at /inventory - cross-store views for ADMIN.
 */
export const inventoryRouter = Router();

/** GET /inventory/low-stock - replenishment feed across every store (ADMIN). */
inventoryRouter.get(
  '/low-stock',
  requireAuth,
  requireRole('ADMIN'),
  validate({ query: z.object({ ...pageQuery }) }),
  asyncHandler(async (req, res) => {
    const { items, totalItems } = await inventory.listLowStock(null, req.query);
    return paged(res, items, { page: req.query.page, size: req.query.size, totalItems });
  })
);
