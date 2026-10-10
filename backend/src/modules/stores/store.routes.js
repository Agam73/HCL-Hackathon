import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import validate from '../../middleware/validate.js';
import { ok, created, paged } from '../../utils/response.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { storeIdParam } from '../../utils/schemas.js';
import * as stores from './store.service.js';
import { listStoresQuery, createStoreBody, updateStoreBody } from './store.schema.js';
import { storeInventoryRouter } from '../inventory/inventory.routes.js';
import { storeOrdersRouter } from '../orders/order.routes.js';

const router = Router();

/** GET /stores?city=&country=&type=&q=&hasProductId=&page=&size= */
router.get(
  '/',
  validate({ query: listStoresQuery }),
  asyncHandler(async (req, res) => {
    const { items, totalItems } = await stores.listStores(req.query);
    return paged(res, items, { page: req.query.page, size: req.query.size, totalItems });
  })
);

/** GET /stores/cities - for the store-location picker. */
router.get(
  '/cities',
  asyncHandler(async (req, res) => {
    const cities = await stores.listStoreCities();
    return ok(res, cities);
  })
);

/** GET /stores/:storeId */
router.get(
  '/:storeId',
  validate({ params: storeIdParam }),
  asyncHandler(async (req, res) => {
    const store = await stores.getStore(req.params.storeId);
    return ok(res, store);
  })
);

/** POST /stores - ADMIN opens a store or warehouse. */
router.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createStoreBody }),
  asyncHandler(async (req, res) => created(res, await stores.createStore(req.body)))
);

/** PATCH /stores/:storeId - ADMIN edits a store. */
router.patch(
  '/:storeId',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: storeIdParam, body: updateStoreBody }),
  asyncHandler(async (req, res) => ok(res, await stores.updateStore(req.params.storeId, req.body)))
);

/** DELETE /stores/:storeId - ADMIN closes a store (soft delete: isActive = false). */
router.delete(
  '/:storeId',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: storeIdParam }),
  asyncHandler(async (req, res) => ok(res, await stores.deactivateStore(req.params.storeId)))
);

// /stores/:storeId/inventory/...
router.use('/:storeId/inventory', storeInventoryRouter);

// /stores/:storeId/orders - the store's fulfilment queue
router.use('/:storeId/orders', storeOrdersRouter);

export default router;
