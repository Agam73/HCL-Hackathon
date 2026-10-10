import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import validate from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { ok } from '../../utils/response.js';
import * as cart from './cart.service.js';
import { addItemBody, updateItemBody, cartItemParams } from './cart.schema.js';

const router = Router();

// The cart always belongs to the token's user - there is no cart id in any URL.
router.use(requireAuth);

/** GET /cart - items, totals, tier perks, stock issues at the preferred store. */
router.get(
  '/',
  asyncHandler(async (req, res) => ok(res, await cart.getCart(req.user.id)))
);

/** POST /cart/items { productId, quantity? } - adds or increments. */
router.post(
  '/items',
  validate({ body: addItemBody }),
  asyncHandler(async (req, res) => ok(res, await cart.addItem(req.user.id, req.body)))
);

/** PATCH /cart/items/:productId { quantity } */
router.patch(
  '/items/:productId',
  validate({ params: cartItemParams, body: updateItemBody }),
  asyncHandler(async (req, res) =>
    ok(res, await cart.updateItem(req.user.id, req.params.productId, req.body))
  )
);

/** DELETE /cart/items/:productId */
router.delete(
  '/items/:productId',
  validate({ params: cartItemParams }),
  asyncHandler(async (req, res) =>
    ok(res, await cart.removeItem(req.user.id, req.params.productId))
  )
);

/** DELETE /cart - empty the cart. */
router.delete(
  '/',
  asyncHandler(async (req, res) => ok(res, await cart.clearCart(req.user.id)))
);

export default router;
