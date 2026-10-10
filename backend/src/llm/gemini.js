import env from '../config/env.js';

export class LlmError extends Error {
  constructor(message, { retryable = false } = {}) {
    super(message);
    this.name = 'LlmError';
    this.retryable = retryable;
  }
}

// A rejected key will not start working on the next request. After an auth
// failure the model is skipped for a while, so every request does not pay for
// a doomed round trip before the fallback answers.
const SUSPEND_MS = 5 * 60_000;
let suspendedUntil = 0;

export const isModelSuspended = () => Date.now() < suspendedUntil;
export const resetModelSuspension = () => {
  suspendedUntil = 0;
};

/** True when a model API key is configured and usable. Tests never call out, key or not. */
export const isLlmConfigured = () =>
  Boolean(env.geminiApiKey) && env.nodeEnv !== 'test' && !isModelSuspended();

/**
 * One JSON-mode call to Gemini. Returns the model's raw text (expected to be
 * JSON); the caller validates it. The key goes in a header, never in the URL,
 * so it cannot end up in request logs.
 */
export async function generateJson({ system, user, temperature = 0.2 }) {
  if (!env.geminiApiKey) throw new LlmError('GEMINI_API_KEY is not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.geminiModel)}:generateContent`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiApiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(env.llmTimeoutMs),
    });
  } catch (err) {
    throw new LlmError(
      err.name === 'TimeoutError'
        ? 'The model did not answer in time'
        : 'The model could not be reached',
      { retryable: true }
    );
  }

  if (!response.ok) {
    // 400 "API key not valid", 401 and 403 all mean the credentials are the problem.
    const detail = await response.json().catch(() => null);
    const badKey =
      response.status === 401 ||
      response.status === 403 ||
      (response.status === 400 && /api key/i.test(detail?.error?.message ?? ''));
    if (badKey) {
      suspendedUntil = Date.now() + SUSPEND_MS;
      console.warn(
        '[llm] the model API rejected GEMINI_API_KEY; using the rule-based engine for 5 minutes'
      );
      throw new LlmError('The model API rejected the API key');
    }
    throw new LlmError(`The model API answered HTTP ${response.status}`, {
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  const data = await response.json().catch(() => null);
  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  if (!text) throw new LlmError('The model returned an empty answer');
  return text;
}
