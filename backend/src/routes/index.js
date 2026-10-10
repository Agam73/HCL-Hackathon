import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import productRoutes, { categoryRouter, brandRouter } from '../modules/catalog/product.routes.js';
import storeRoutes from '../modules/stores/store.routes.js';
import { inventoryRouter } from '../modules/inventory/inventory.routes.js';
import cartRoutes from '../modules/cart/cart.routes.js';
import orderRoutes from '../modules/orders/order.routes.js';
import assistantRoutes from '../modules/assistant/assistant.routes.js';
import { ok } from '../utils/response.js';

const router = Router();

/**
 * API surface. Add new modules here - one line per feature area.
 *
 *   /auth        login, register, refresh, logout, me, staff
 *   /products    search / filter / sort / paginate, detail, availability
 *   /categories  category list (flat or ?tree=true)
 *   /brands      brand list
 *   /stores      store list, detail, cities, inventory by store
 *   /inventory   cross-store replenishment views (ADMIN)
 *   /cart        cart with tier-aware delivery perks
 *   /orders      checkout (pickup / delivery), history, cancel, fulfilment status
 *   /assistant   AI product recommendations from a free-text request
 *
 * Still to be built by the team (mount here when ready):
 *   /kb          document ingest + RAG answers    (Module 2)
 *   /agents      agent orchestration + audit      (Module 3)
 */
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRouter);
router.use('/brands', brandRouter);
router.use('/stores', storeRoutes);
router.use('/inventory', inventoryRouter);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/assistant', assistantRoutes);

/** Lists what is live - handy during the demo and for the frontend to probe. */
router.get('/', (req, res) =>
  ok(res, {
    name: 'RetailPulse AI API',
    version: '0.1.0',
    endpoints: [
      'POST   /auth/register',
      'POST   /auth/login',
      'POST   /auth/refresh',
      'POST   /auth/logout',
      'POST   /auth/admin-device                        (trusted admin PC only)',
      'GET    /auth/me',
      'PATCH  /auth/me',
      'POST   /auth/staff                              (ADMIN)',
      'GET    /products?q=&categoryId=&brandId=&minPrice=&maxPrice=&minRating=&storeId=&inStockOnly=&sort=&page=&size=',
      'GET    /products/:productId',
      'POST   /products                                 (ADMIN)',
      'PATCH  /products/:productId                      (ADMIN)',
      'DELETE /products/:productId                      (ADMIN, retires it)',
      'GET    /products/:productId/availability?city=&inStockOnly=&nearStoreId=',
      'GET    /categories?tree=true',
      'GET    /brands',
      'GET    /stores?city=&country=&type=&q=',
      'GET    /stores/cities',
      'GET    /stores/:storeId',
      'POST   /stores                                   (ADMIN)',
      'PATCH  /stores/:storeId                          (ADMIN)',
      'DELETE /stores/:storeId                          (ADMIN, closes it)',
      'GET    /stores/:storeId/inventory',
      'GET    /stores/:storeId/inventory/:productId',
      'PATCH  /stores/:storeId/inventory/:productId     (STORE_MANAGER own store | ADMIN)',
      'GET    /stores/:storeId/inventory/low-stock      (STORE_MANAGER own store | ADMIN)',
      'GET    /stores/:storeId/inventory/movements      (STORE_MANAGER own store | ADMIN)',
      'GET    /inventory/low-stock                      (ADMIN)',
      'GET    /cart                                     (logged in)',
      'POST   /cart/items                               (logged in)',
      'PATCH  /cart/items/:productId                    (logged in)',
      'DELETE /cart/items/:productId                    (logged in)',
      'DELETE /cart                                     (logged in)',
      'POST   /orders                                   (logged in, checks out the cart)',
      'GET    /orders                                   (logged in, own history)',
      'GET    /orders/:orderRef                         (owner | store manager | ADMIN)',
      'POST   /orders/:orderRef/cancel                  (owner)',
      'PATCH  /orders/:orderRef/status                  (STORE_MANAGER own store | ADMIN)',
      'GET    /stores/:storeId/orders                   (STORE_MANAGER own store | ADMIN)',
      'POST   /assistant/recommendations                (public; personalised when logged in)',
      'POST   /assistant/chat                           (public; product picks or policy answers)',
    ],
  })
);

export default router;
