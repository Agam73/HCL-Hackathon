import { jest } from '@jest/globals';
import env from '../../src/config/env.js';
import {
  generateJson,
  isModelSuspended,
  resetModelSuspension,
  LlmError,
} from '../../src/llm/gemini.js';

const realFetch = globalThis.fetch;
const realKey = env.geminiApiKey;
const respond = (status, body) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  env.geminiApiKey = 'test-key';
  resetModelSuspension();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  globalThis.fetch = realFetch;
  env.geminiApiKey = realKey;
  resetModelSuspension();
  jest.restoreAllMocks();
});

describe('generateJson', () => {
  test('sends the key in a header, never in the URL, and returns the model text', async () => {
    let seen;
    globalThis.fetch = async (url, init) => {
      seen = { url, init };
      return respond(200, {
        candidates: [{ content: { parts: [{ text: '{"a":' }, { text: '1}' }] } }],
      });
    };
    expect(await generateJson({ system: 'S', user: 'U' })).toBe('{"a":1}');
    expect(seen.url).not.toContain('test-key');
    expect(seen.init.headers['x-goog-api-key']).toBe('test-key');
    expect(JSON.parse(seen.init.body).generationConfig.responseMimeType).toBe('application/json');
  });

  test('a rejected API key suspends the model instead of retrying it on every request', async () => {
    globalThis.fetch = async () =>
      respond(400, { error: { message: 'API key not valid. Please pass a valid API key.' } });
    await expect(generateJson({ system: 'S', user: 'U' })).rejects.toThrow(/rejected the API key/);
    expect(isModelSuspended()).toBe(true);
  });

  test('an ordinary bad request or an outage does not suspend the model', async () => {
    globalThis.fetch = async () => respond(400, { error: { message: 'Invalid JSON payload' } });
    await expect(generateJson({ system: 'S', user: 'U' })).rejects.toBeInstanceOf(LlmError);
    expect(isModelSuspended()).toBe(false);

    globalThis.fetch = async () => respond(503, {});
    await expect(generateJson({ system: 'S', user: 'U' })).rejects.toMatchObject({
      retryable: true,
    });
    expect(isModelSuspended()).toBe(false);
  });

  test('a network failure and an empty answer are reported as model errors', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(generateJson({ system: 'S', user: 'U' })).rejects.toThrow(/could not be reached/);

    globalThis.fetch = async () => respond(200, { candidates: [] });
    await expect(generateJson({ system: 'S', user: 'U' })).rejects.toThrow(/empty answer/);
  });

  test('without a key it refuses before making any request', async () => {
    env.geminiApiKey = '';
    let called = false;
    globalThis.fetch = async () => {
      called = true;
    };
    await expect(generateJson({ system: 'S', user: 'U' })).rejects.toThrow(/not configured/);
    expect(called).toBe(false);
  });
});
