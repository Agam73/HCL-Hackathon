import { z } from 'zod';
import { pageQuery } from '../../utils/schemas.js';

const time = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Use HH:MM (24-hour)')
  .nullable();

const storeFields = {
  name: z.string().trim().min(2).max(120),
  type: z.enum(['STORE', 'WAREHOUSE']),
  addressLine: z.string().trim().max(200).nullable(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().max(80).nullable(),
  country: z.string().trim().length(2).toUpperCase(),
  postalCode: z.string().trim().max(20).nullable(),
  latitude: z.coerce.number().min(-90).max(90).nullable(),
  longitude: z.coerce.number().min(-180).max(180).nullable(),
  phone: z.string().trim().max(30).nullable(),
  opensAt: time,
  closesAt: time,
  isActive: z.boolean(),
};

/** ADMIN: create a store or warehouse. */
export const createStoreBody = z.object({
  id: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,32}$/, 'Use 3-32 letters, digits or hyphens, e.g. ST-PUN-01'),
  name: storeFields.name,
  type: storeFields.type.default('STORE'),
  addressLine: storeFields.addressLine.optional(),
  city: storeFields.city,
  state: storeFields.state.optional(),
  country: storeFields.country.default('IN'),
  postalCode: storeFields.postalCode.optional(),
  latitude: storeFields.latitude.optional(),
  longitude: storeFields.longitude.optional(),
  phone: storeFields.phone.optional(),
  opensAt: storeFields.opensAt.optional(),
  closesAt: storeFields.closesAt.optional(),
  isActive: storeFields.isActive.default(true),
});

/** ADMIN: change any subset of a store's fields. */
export const updateStoreBody = z
  .object(storeFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });

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
