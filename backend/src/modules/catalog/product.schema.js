import { z } from 'zod';
import { pageQuery, csvList } from '../../utils/schemas.js';

export const SORT_OPTIONS = [
  'relevance',
  'price_asc',
  'price_desc',
  'rating_desc',
  'name_asc',
  'newest',
];

export const listProductsQuery = z
  .object({
    ...pageQuery,
    q: z.string().trim().min(1).max(120).optional(),
    categoryId: csvList.optional(),
    categorySlug: csvList.optional(),
    brandId: csvList.optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    storeId: z.string().trim().max(64).optional(),
    inStockOnly: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .transform((v) => v === true || v === 'true' || v === '1')
      .optional(),
    sort: z.enum(SORT_OPTIONS).optional(),
  })
  .refine(
    (v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice,
    { message: 'minPrice must be less than or equal to maxPrice', path: ['minPrice'] }
  );

export const productAvailabilityQuery = z.object({
  city: z.string().trim().max(80).optional(),
  country: z.string().trim().length(2).toUpperCase().optional(),
  inStockOnly: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((v) => v === true || v === 'true' || v === '1')
    .optional(),
});

export const listCategoriesQuery = z.object({
  tree: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((v) => v === true || v === 'true' || v === '1')
    .optional(),
});
