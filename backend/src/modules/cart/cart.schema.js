import { z } from 'zod';
import { MAX_QUANTITY_PER_ITEM } from './cart.pricing.js';

const quantity = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_QUANTITY_PER_ITEM, `At most ${MAX_QUANTITY_PER_ITEM} of one product per order`);

export const addItemBody = z.object({
  productId: z.string().trim().min(1).max(64),
  quantity: quantity.default(1),
});

export const updateItemBody = z.object({ quantity });

export const cartItemParams = z.object({
  productId: z.string().min(1).max(64),
});
