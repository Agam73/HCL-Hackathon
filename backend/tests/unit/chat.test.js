import { jest } from '@jest/globals';
import env from '../../src/config/env.js';
import { classifyMessage, chat } from '../../src/modules/assistant/assistant.chat.js';
import { askPolicy } from '../../src/modules/kb/kb.service.js';

describe('classifyMessage', () => {
  test.each([
    'Can I return an opened mobile phone purchased online?',
    'What is the warranty period for a refrigerator compressor?',
    'Do Gold members get free express delivery?',
    'How do I factory reset my smartphone?',
    'What is your refund policy?',
    'How long does shipping take to Mumbai?',
  ])('policy: %s', (message) => {
    expect(classifyMessage(message)).toBe('policy');
  });

  test.each([
    'laptop for Java development',
    '5G phone under 20000',
    'running shoes for jogging',
    'a fridge for a family of five',
    'best headphones under 10000 with good warranty',
    'show me a washing machine below 30k that includes delivery',
  ])('products: %s', (message) => {
    expect(classifyMessage(message)).toBe('products');
  });
});

describe('chat', () => {
  test('a policy question goes to the knowledge base and comes back labelled', async () => {
    const ask = jest.fn(async () => ({
      answer: '14 days.',
      confidence: 'HIGH',
      sources: [{ document: 'Return Policy', section: '4', version: '2026.1' }],
      followUpRequired: false,
    }));
    const out = await chat({ message: 'Can I return an opened phone?', limit: 3 }, { ask });
    expect(out).toMatchObject({ type: 'policy', answer: '14 days.', confidence: 'HIGH' });
    expect(ask).toHaveBeenCalledWith('Can I return an opened phone?', { user: null });
  });
});

describe('askPolicy', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

  test('calls the RAG service with the shared key and returns its contract', async () => {
    let seen;
    globalThis.fetch = async (url, init) => {
      seen = { url, init };
      return reply(200, {
        answer: 'Yes.',
        confidence: 'MEDIUM',
        sources: [],
        followUpRequired: true,
      });
    };
    const out = await askPolicy('Can I return it?');
    expect(out).toEqual({
      answer: 'Yes.',
      confidence: 'MEDIUM',
      sources: [],
      followUpRequired: true,
    });
    expect(seen.url).toBe(`${env.aiServiceUrl}/api/v1/knowledge/query`);
    expect(seen.init.headers.Authorization).toBe(`Bearer ${env.aiServiceApiKey}`);
    // No signed-in user: the region defaults to IN and no tier is claimed.
    expect(JSON.parse(seen.init.body)).toEqual({ question: 'Can I return it?', region: 'IN' });
  });

  test.each([
    [
      'is not running',
      async () => {
        throw new TypeError('fetch failed');
      },
      /not running/,
    ],
    ['rejects the key', async () => reply(401, {}), /service key/],
    ['errors', async () => reply(503, {}), /HTTP 503/],
    ['returns junk', async () => reply(200, { nope: 1 }), /unreadable/],
  ])('reports a clean 503 when the service %s', async (_label, impl, pattern) => {
    globalThis.fetch = impl;
    await expect(askPolicy('question?')).rejects.toMatchObject({
      status: 503,
      code: 'KB_UNAVAILABLE',
      message: expect.stringMatching(pattern),
    });
  });
});
