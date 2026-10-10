import { z } from 'zod';

export const MAX_RECOMMENDATIONS = 8;

/** POST /assistant/recommendations */
export const recommendBody = z.object({
  query: z.string().trim().min(3, 'Tell me a little more about what you need').max(500),
  // Check stock at this store; defaults to the signed-in customer's preferred store.
  storeId: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_RECOMMENDATIONS).default(4),
});

/** POST /assistant/chat - one message from the chat box. */
export const chatBody = z.object({
  message: z.string().trim().min(3, 'Tell me a little more').max(500),
  storeId: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_RECOMMENDATIONS).default(3),
});

/**
 * What the model must return. Anything else is rejected and the model is
 * asked once to repair it. Product names, prices and stock are NOT taken
 * from the model - only which products and why.
 */
export const modelOutput = z.object({
  interpretedRequirement: z.string().trim().min(3).max(400),
  recommendations: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(64),
        reason: z.string().trim().min(3).max(400),
      })
    )
    .max(MAX_RECOMMENDATIONS),
  clarifyingQuestion: z.string().trim().max(300).nullable(),
});
