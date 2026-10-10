import { z } from 'zod';
import { pageQuery } from '../../utils/schemas.js';

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PACKED',
  'SHIPPED',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
];

const shippingAddress = z.object({
  line: z.string().trim().min(3).max(200),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().min(3).max(20),
  phone: z.string().trim().min(6).max(20).optional(),
});

/** POST /orders - check out the caller's cart. */
export const placeOrderBody = z
  .object({
    fulfillment: z.enum(['IN_STORE_PICKUP', 'HOME_DELIVERY']),
    // Pickup: where to collect (defaults to the customer's preferred store).
    storeId: z.string().trim().min(1).max(64).optional(),
    // Delivery only.
    deliverySpeed: z.enum(['STANDARD', 'EXPRESS']).default('STANDARD'),
    shippingAddress: shippingAddress.optional(),
    paymentMethod: z.enum(['CARD', 'UPI', 'NET_BANKING', 'CASH_ON_DELIVERY']).default('UPI'),
    // Retrying a checkout with the same key returns the first order instead of
    // creating a second one. The Idempotency-Key header works too.
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
    // Payment is simulated; this lets a demo or test show the decline path.
    simulatePaymentFailure: z.boolean().default(false),
  })
  .refine((b) => b.fulfillment !== 'HOME_DELIVERY' || b.shippingAddress !== undefined, {
    message: 'shippingAddress is required for home delivery',
    path: ['shippingAddress'],
  });

export const listOrdersQuery = z.object({
  ...pageQuery,
  status: z.enum(ORDER_STATUSES).optional(),
});

/** Order id (uuid) or order number (NM-20261010-A1B2C3). */
export const orderRefParam = z.object({
  orderRef: z.string().trim().min(6).max(64),
});

export const updateStatusBody = z.object({
  status: z.enum(ORDER_STATUSES),
});
