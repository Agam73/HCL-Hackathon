import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import validate from '../../middleware/validate.js';
import { ok, paged } from '../../utils/response.js';
import { storeIdParam } from '../../utils/schemas.js';
import * as stores from './store.service.js';
import { listStoresQuery } from './store.schema.js';
import { storeInventoryRouter } from '../inventory/inventory.routes.js';

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

// /stores/:storeId/inventory/...
router.use('/:storeId/inventory', storeInventoryRouter);

export default router;
