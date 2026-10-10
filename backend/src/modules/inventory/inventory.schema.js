import { z } from 'zod';
import { pageQuery, csvList } from '../../utils/schemas.js';

export const storeInventoryQuery = z.object({
  ...pageQuery,
  q: z.string().trim().min(1).max(120).optional(),
  categoryId: csvList.optional(),
  brandId: csvList.optional(),
  lowStockOnly: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((v) => v === true || v === 'true' || v === '1')
    .optional(),
  inStockOnly: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((v) => v === true || v === 'true' || v === '1')
    .optional(),
  status: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).optional(),
  sort: z.enum(['quantity_asc', 'quantity_desc', 'name_asc', 'shortfall_desc']).optional(),
});

export const upsertInventoryBody = z
  .object({
    // Either set an absolute quantity...
    quantityAvailable: z.coerce.number().int().min(0).optional(),
    // ...or adjust it relatively (can be negative, e.g. -3 for a sale).
    delta: z.coerce.number().int().optional(),
    reorderLevel: z.coerce.number().int().min(0).optional(),
    reason: z.string().trim().max(240).optional(),
  })
  .refine((b) => b.quantityAvailable !== undefined || b.delta !== undefined || b.reorderLevel !== undefined, {
    message: 'Provide quantityAvailable, delta or reorderLevel',
  })
  .refine((b) => !(b.quantityAvailable !== undefined && b.delta !== undefined), {
    message: 'Use either quantityAvailable or delta, not both',
    path: ['delta'],
  });
