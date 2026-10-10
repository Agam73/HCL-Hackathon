import { z } from 'zod';
import { MEMBERSHIP_TIERS, USER_ROLES } from '../../utils/schemas.js';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const registerBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password,
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(20).optional(),
  city: z.string().trim().max(80).optional(),
  country: z.string().trim().length(2).toUpperCase().default('IN'),
  membershipTier: z.enum(MEMBERSHIP_TIERS).default('STANDARD'),
  preferredStoreId: z.string().trim().max(64).optional(),
  preferences: z
    .object({
      categories: z.array(z.string()).max(20).optional(),
      brands: z.array(z.string()).max(20).optional(),
      budgetMax: z.number().nonnegative().optional(),
    })
    .partial()
    .default({}),
});

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
});

export const refreshBody = z.object({
  refreshToken: z.string().min(20).max(512),
});

/** ADMIN-only: create STORE_MANAGER / ADMIN accounts. */
export const createStaffBody = registerBody.extend({
  role: z.enum(USER_ROLES),
  managedStoreId: z.string().trim().max(64).optional(),
});

export const updateMeBody = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().min(6).max(20).optional(),
    city: z.string().trim().max(80).optional(),
    preferredStoreId: z.string().trim().max(64).nullable().optional(),
    preferences: z
      .object({
        categories: z.array(z.string()).max(20).optional(),
        brands: z.array(z.string()).max(20).optional(),
        budgetMax: z.number().nonnegative().optional(),
      })
      .partial()
      .optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  });
