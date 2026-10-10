import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import productRoutes, { categoryRouter, brandRouter } from '../modules/catalog/product.routes.js';
import storeRoutes from '../modules/stores/store.routes.js';
import { inventoryRouter } from '../modules/inventory/inventory.routes.js';
import { ok } from '../utils/response.js';

const router = Router();

/**
 * API surface. Add new modules here - one line per feature area.
 *
 *   /auth        login, register, me, staff
 *   /products    search / filter / sort / paginate, detail, availability
 *   /categories  category list (flat or ?tree=true)
 *   /brands      brand list
 *   /stores      store list, detail, cities, inventory by store
 *   /inventory   cross-store replenishment views (ADMIN)
 *
 * Still to be built by the team (mount here when ready):
 *   /cart        cart + customer preferences      (Module 1)
 *   /orders      checkout, pickup/delivery        (Module 1)
 *   /assistant   AI recommendations               (Module 1)
 *   /kb          document ingest + RAG answers    (Module 2)
 *   /agents      agent orchestration + audit      (Module 3)
 */
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRouter);
router.use('/brands', brandRouter);
router.use('/stores', storeRoutes);
router.use('/inventory', inventoryRouter);

/** Lists what is live - handy during the demo and for the frontend to probe. */
router.get('/', (req, res) =>
  ok(res, {
    name: 'RetailPulse AI API',
    version: '0.1.0',
    endpoints: [
      'POST   /auth/register',
      'POST   /auth/login',
      'GET    /auth/me',
      'PATCH  /auth/me',
      'POST   /auth/staff                              (ADMIN)',
      'GET    /products?q=&categoryId=&brandId=&minPrice=&maxPrice=&minRating=&storeId=&inStockOnly=&sort=&page=&size=',
      'GET    /products/:productId',
      'GET    /products/:productId/availability',
      'GET    /categories?tree=true',
      'GET    /brands',
      'GET    /stores?city=&country=&type=&q=',
      'GET    /stores/cities',
      'GET    /stores/:storeId',
      'GET    /stores/:storeId/inventory',
      'GET    /stores/:storeId/inventory/:productId',
      'PATCH  /stores/:storeId/inventory/:productId     (STORE_MANAGER own store | ADMIN)',
      'GET    /stores/:storeId/inventory/low-stock      (STORE_MANAGER own store | ADMIN)',
      'GET    /inventory/low-stock                      (ADMIN)',
    ],
  })
);

export default router;
