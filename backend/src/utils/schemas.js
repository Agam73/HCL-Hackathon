import { z } from 'zod';

/** Shared zod building blocks so every endpoint validates the same way. */

export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
};

/** "a, b ,c" -> ['a','b','c']; also accepts repeated query params. */
export const csvList = z
  .union([z.string(), z.array(z.string())])
  .transform((v) =>
    (Array.isArray(v) ? v : v.split(','))
      .map((s) => s.trim())
      .filter(Boolean)
  );

export const productIdParam = z.object({
  productId: z.string().min(1).max(64),
});

export const storeIdParam = z.object({
  storeId: z.string().min(1).max(64),
});

export const storeProductParams = z.object({
  storeId: z.string().min(1).max(64),
  productId: z.string().min(1).max(64),
});

export const MEMBERSHIP_TIERS = ['STANDARD', 'SILVER', 'GOLD', 'PLATINUM'];
export const USER_ROLES = ['CUSTOMER', 'STORE_MANAGER', 'SUPPORT_AGENT', 'ADMIN'];

/** Offset helper: page is 1-based. */
export function toOffset({ page, size }) {
  return (page - 1) * size;
}
