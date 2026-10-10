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
    // Honoured for ADMIN only: also list products that have been taken off sale.
    includeInactive: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .transform((v) => v === true || v === 'true' || v === '1')
      .optional(),
  })
  .refine(
    (v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice,
    { message: 'minPrice must be less than or equal to maxPrice', path: ['minPrice'] }
  );

const productFields = {
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).nullable(),
  keywords: z.string().trim().max(500).nullable(),
  categoryId: z.string().trim().min(1).max(64),
  brandId: z.string().trim().min(1).max(64),
  price: z.coerce.number().nonnegative().max(99_999_999),
  mrp: z.coerce.number().nonnegative().max(99_999_999).nullable(),
  specifications: z.record(z.union([z.string(), z.number(), z.boolean()])),
  images: z.array(z.string().url().max(500)).max(10),
  warrantyMonths: z.coerce.number().int().min(0).max(240).nullable(),
  isActive: z.boolean(),
};

const mrpNotBelowPrice = (v) => v.mrp == null || v.price === undefined || v.mrp >= v.price;
const mrpMessage = { message: 'mrp must be greater than or equal to price', path: ['mrp'] };

/** ADMIN: create a product. The id is generated unless one is supplied. */
export const createProductBody = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]{2,32}$/, 'Use 2-32 letters, digits or hyphens')
      .optional(),
    name: productFields.name,
    description: productFields.description.optional(),
    keywords: productFields.keywords.optional(),
    categoryId: productFields.categoryId,
    brandId: productFields.brandId,
    price: productFields.price,
    mrp: productFields.mrp.optional(),
    specifications: productFields.specifications.default({}),
    images: productFields.images.default([]),
    warrantyMonths: productFields.warrantyMonths.optional(),
    isActive: productFields.isActive.default(true),
  })
  .refine(mrpNotBelowPrice, mrpMessage);

/** ADMIN: change any subset of a product's fields. */
export const updateProductBody = z
  .object(productFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' })
  .refine(mrpNotBelowPrice, mrpMessage);

export const productAvailabilityQuery = z.object({
  city: z.string().trim().max(80).optional(),
  country: z.string().trim().length(2).toUpperCase().optional(),
  inStockOnly: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((v) => v === true || v === 'true' || v === '1')
    .optional(),
  // Adds distanceKm from this store and orders the result nearest-first.
  nearStoreId: z.string().trim().min(1).max(64).optional(),
});

export const listCategoriesQuery = z.object({
  tree: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((v) => v === true || v === 'true' || v === '1')
    .optional(),
});
