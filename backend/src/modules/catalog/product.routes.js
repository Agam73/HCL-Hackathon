import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import validate from '../../middleware/validate.js';
import { optionalAuth } from '../../middleware/auth.js';
import { ok, paged } from '../../utils/response.js';
import { productIdParam } from '../../utils/schemas.js';
import * as catalog from './product.service.js';
import {
  listProductsQuery,
  productAvailabilityQuery,
  listCategoriesQuery,
} from './product.schema.js';

const router = Router();

/**
 * GET /products
 * Search, filter, sort, paginate.
 *   q, categoryId, categorySlug, brandId (csv), minPrice, maxPrice, minRating,
 *   storeId, inStockOnly, sort, page, size
 * Public; a token (if sent) is attached so personalisation can be layered later.
 */
router.get(
  '/',
  optionalAuth,
  validate({ query: listProductsQuery }),
  asyncHandler(async (req, res) => {
    const { items, totalItems } = await catalog.listProducts(req.query);
    return paged(res, items, { page: req.query.page, size: req.query.size, totalItems });
  })
);

/** GET /products/:productId - detail + availability by store + related items. */
router.get(
  '/:productId',
  optionalAuth,
  validate({ params: productIdParam }),
  asyncHandler(async (req, res) => {
    const product = await catalog.getProductDetail(req.params.productId);
    return ok(res, product);
  })
);

/** GET /products/:productId/availability?city=&country=&inStockOnly= */
router.get(
  '/:productId/availability',
  validate({ params: productIdParam, query: productAvailabilityQuery }),
  asyncHandler(async (req, res) => {
    const availability = await catalog.getProductAvailability(req.params.productId, req.query);
    return ok(res, availability);
  })
);

export default router;

/** Separate routers for /categories and /brands, mounted in routes/index.js. */
export const categoryRouter = Router().get(
  '/',
  validate({ query: listCategoriesQuery }),
  asyncHandler(async (req, res) => {
    const categories = await catalog.listCategories(req.query);
    return ok(res, categories);
  })
);

export const brandRouter = Router().get(
  '/',
  asyncHandler(async (req, res) => {
    const brands = await catalog.listBrands();
    return ok(res, brands);
  })
);
