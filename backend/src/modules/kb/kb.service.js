import { queryOne } from '../../db/pool.js';
import env from '../../config/env.js';
import ApiError from '../../utils/ApiError.js';

const unavailable = (message) => new ApiError(503, 'KB_UNAVAILABLE', message);

/**
 * Ask the RAG microservice (ai-service/) a policy question.
 *
 * The membership tier and country sent to it come from the signed-in user's
 * row in the database - never from the request - so a customer cannot read a
 * higher tier's documents by claiming to be Platinum.
 *
 * @returns {{ answer, confidence, sources: [{ document, section, version }], followUpRequired }}
 */
export async function askPolicy(question, { user = null, category } = {}) {
  const profile = user
    ? await queryOne('SELECT membership_tier, country FROM users WHERE id = $1', [user.id])
    : null;

  let response;
  try {
    response = await fetch(`${env.aiServiceUrl}/api/v1/knowledge/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.aiServiceApiKey}`,
        ...(user ? { 'X-Internal-Actor': user.id } : {}),
      },
      body: JSON.stringify({
        question,
        region: profile?.country ?? 'IN',
        ...(profile ? { membershipTier: profile.membership_tier } : {}),
        ...(category ? { category } : {}),
      }),
      signal: AbortSignal.timeout(env.aiServiceTimeoutMs),
    });
  } catch (err) {
    throw unavailable(
      err.name === 'TimeoutError'
        ? 'The policy assistant took too long to answer'
        : 'The policy assistant is not running'
    );
  }

  if (response.status === 401) {
    throw unavailable('The policy assistant rejected the service key (AI_SERVICE_API_KEY)');
  }
  if (!response.ok) throw unavailable(`The policy assistant answered HTTP ${response.status}`);

  const data = await response.json().catch(() => null);
  if (!data || typeof data.answer !== 'string') {
    throw unavailable('The policy assistant returned an unreadable answer');
  }
  return {
    answer: data.answer,
    confidence: data.confidence ?? 'LOW',
    sources: Array.isArray(data.sources) ? data.sources : [],
    followUpRequired: Boolean(data.followUpRequired),
  };
}
