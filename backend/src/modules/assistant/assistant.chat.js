import { parseBudget } from './assistant.intent.js';
import { recommend } from './assistant.service.js';
import { askPolicy } from '../kb/kb.service.js';

const POLICY_WORDS =
  /\b(returns?|returned|returning|refunds?|exchange|warranty|guarantee|shipping|delivery|delivered|policy|policies|membership|benefits?|cancel|cancellation|replacement|repair|installation|manual|troubleshoot|reset|how (do|can|to|long)|what is your|am i (allowed|eligible)|can i|do you|does)\b/i;
const SHOPPING_WORDS =
  /\b(buy|recommend|suggest|looking for|need a|want a|best|cheap|under|below|budget|show me)\b/i;

/**
 * Decide what a chat message is asking for.
 *   policy   - returns, warranty, delivery, membership, product how-tos (answered from documents)
 *   products - a shopping request (answered from the catalogue)
 */
export function classifyMessage(message) {
  const policy = POLICY_WORDS.test(message);
  if (!policy) return 'products';
  if (!SHOPPING_WORDS.test(message)) return 'policy';
  // Both kinds of word: a stated budget means they are shopping.
  const { min, max } = parseBudget(message);
  return min != null || max != null ? 'products' : 'policy';
}

/**
 * One entry point for the storefront chat box. Returns either
 *   { type: 'policy', answer, confidence, sources, followUpRequired }
 *   { type: 'products', interpretedRequirement, recommendations, clarifyingQuestion, meta }
 */
export async function chat(
  { message, storeId, limit },
  { user = null, traceId, ask = askPolicy } = {}
) {
  if (classifyMessage(message) === 'policy') {
    return { type: 'policy', ...(await ask(message, { user })) };
  }
  const result = await recommend({ query: message, storeId, limit }, { user, traceId });
  return { type: 'products', ...result };
}
