import { z } from 'zod';
import { pageQuery } from '../../utils/schemas.js';

export const listStoresQuery = z.object({
  ...pageQuery,
  q: z.string().trim().min(1).max(120).optional(),
  city: z.string().trim().max(80).optional(),
  country: z.string().trim().length(2).toUpperCase().optional(),
  type: z.enum(['STORE', 'WAREHOUSE']).optional(),
  // Products this store must have in stock (csv of product ids)
  hasProductId: z.string().trim().max(64).optional(),
  activeOnly: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((v) => v === true || v === 'true' || v === '1')
    .default('true'),
});
