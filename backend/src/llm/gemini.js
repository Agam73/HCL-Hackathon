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

/** One JSON-mode call to one Gemini model. Returns { text, model }. */
async function callModel(model, { system, user, temperature }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      // The key goes in a header, never in the URL, so it cannot end up in request logs.
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
        ? `${model} did not answer in time`
        : `${model} could not be reached`,
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
    throw new LlmError(`${model} answered HTTP ${response.status}`, {
      // 404 = the model name was retired or never existed: worth trying the other model.
      retryable: [404, 429].includes(response.status) || response.status >= 500,
    });
  }

  const data = await response.json().catch(() => null);
  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  if (!text) throw new LlmError(`${model} returned an empty answer`, { retryable: true });
  return { text, model: data?.modelVersion ?? model };
}

/** The model that produced the most recent successful answer (for the audit log). */
let lastModelUsed = null;
export const getLastModelUsed = () => lastModelUsed;

/**
 * Ask Gemini for a JSON answer; returns the raw text for the caller to
 * validate. If the main model is overloaded, slow or retired, the fallback
 * model is tried once before giving up.
 */
export async function generateJson({ system, user, temperature = 0.2 }) {
  if (!env.geminiApiKey) throw new LlmError('GEMINI_API_KEY is not configured');

  const models = [...new Set([env.geminiModel, env.geminiFallbackModel].filter(Boolean))];
  let lastError;
  for (const model of models) {
    try {
      const answer = await callModel(model, { system, user, temperature });
      lastModelUsed = answer.model;
      return answer.text;
    } catch (err) {
      lastError = err;
      if (!err.retryable) break;
    }
  }
  throw lastError;
}
