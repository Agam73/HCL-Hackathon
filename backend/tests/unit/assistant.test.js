import {
  parseBudget,
  parseIntent,
  describeIntent,
} from '../../src/modules/assistant/assistant.intent.js';
import { recommendByRules } from '../../src/modules/assistant/assistant.rules.js';
import {
  groundRecommendations,
  parseModelOutput,
} from '../../src/modules/assistant/assistant.service.js';

const BRANDS = [
  { id: 'B02', name: 'Apple' },
  { id: 'B06', name: 'Sony' },
  { id: 'B27', name: 'Blue Star' },
  { id: 'B15', name: "Levi's" },
];

describe('parseBudget', () => {
  test.each([
    ['phone under 20000', { min: null, max: 20000 }],
    ['laptop below ₹80,000', { min: null, max: 80000 }],
    ['tv within 50k', { min: null, max: 50000 }],
    ['fridge up to 1.5 lakh', { min: null, max: 150000 }],
    ['budget is rs 45000 for an ac', { min: null, max: 45000 }],
    ['laptop between 60000 and 90000', { min: 60000, max: 90000 }],
    ['between 30k and 50k', { min: 30000, max: 50000 }],
    ['headphones around 10k', { min: 8000, max: 12000 }],
    ['phone above 50000', { min: 50000, max: null }],
    ['a good laptop', { min: null, max: null }],
    // A model number or screen size is not a budget.
    ['iphone 15 128 gb', { min: null, max: null }],
    ['55 inch tv', { min: null, max: null }],
  ])('%s', (text, expected) => {
    expect(parseBudget(text)).toEqual(expected);
  });
});

describe('parseIntent', () => {
  test('product type, purpose and budget from one sentence', () => {
    const intent = parseIntent('I need a laptop for Java development under 90k', BRANDS);
    expect(intent.categories).toEqual(['laptops']);
    expect(intent.useCases.map((u) => u.id)).toEqual(['development']);
    expect(intent.budget).toEqual({ min: null, max: 90000 });
    expect(intent.keywords).toEqual(expect.arrayContaining(['laptop', 'java', 'developer']));
    expect(intent.underspecified).toBe(false);
  });

  test('brands are recognised, including two-word and punctuated names', () => {
    expect(parseIntent('sony headphones', BRANDS).brandIds).toEqual(['B06']);
    expect(parseIntent('blue star window ac', BRANDS).brandIds).toEqual(['B27']);
    expect(parseIntent("levi's jeans", BRANDS).brandIds).toEqual(['B15']);
    // "pineapple" must not match the brand Apple.
    expect(parseIntent('pineapple juice', BRANDS).brandIds).toEqual([]);
  });

  test('a must-have feature is kept even though it starts with a digit', () => {
    const intent = parseIntent('5G phone under 20000', BRANDS);
    expect(intent.useCases).toEqual([{ id: '5g', phrase: '5G', feature: true }]);
    expect(intent.keywords).toContain('5g');
  });

  test('price words set a preference without a number', () => {
    expect(parseIntent('cheap coffee', BRANDS).pricePreference).toBe('low');
    expect(parseIntent('premium tv', BRANDS).pricePreference).toBe('high');
  });

  test.each([
    'something nice',
    'I want to buy a gift for my mom',
    'best one please',
    'what do you recommend?',
  ])('too vague to search: "%s"', (text) => {
    expect(parseIntent(text, BRANDS).underspecified).toBe(true);
  });

  test('a brand alone, or a descriptive word alone, is enough to search', () => {
    expect(parseIntent('something from Apple', BRANDS).underspecified).toBe(false);
    expect(parseIntent('waterproof', BRANDS).underspecified).toBe(false);
  });
});

describe('describeIntent', () => {
  test('reads as one plain sentence', () => {
    const intent = parseIntent('Sony noise cancelling headphones for travel around 10k', BRANDS);
    expect(describeIntent(intent, { brandNames: ['Sony'], storeName: 'NovaMart Powai' })).toBe(
      'A Sony audio product with noise cancelling, priced between ₹8,000 and ₹12,000, with stock checked at NovaMart Powai.'
    );
    expect(describeIntent(parseIntent('air conditioner for a small bedroom', BRANDS))).toBe(
      'An air conditioner for a small room.'
    );
  });
});

const product = (id, overrides = {}) => ({
  id,
  name: `Laptop ${id}`,
  brand: 'Acme',
  category: 'Laptops',
  price: 60000,
  mrp: 60000,
  rating: 4.0,
  ratingCount: 100,
  specifications: { ram: '8 GB', storage: '512 GB SSD' },
  textRank: 0.1,
  availability: {
    scope: 'ALL_STORES',
    storeId: null,
    quantityAvailable: 50,
    storesWithStock: 8,
    status: 'IN_STOCK',
  },
  ...overrides,
});
const rulesFor = (text, candidates, extra = {}) =>
  recommendByRules({ intent: parseIntent(text, BRANDS), candidates, limit: 3, ...extra });

describe('recommendByRules', () => {
  test('specs that suit the stated use outrank a higher rating, and the reason quotes them', () => {
    const { recommendations } = rulesFor('laptop for java development', [
      product('A', { rating: 4.8 }),
      product('B', { rating: 4.1, specifications: { ram: '32 GB', storage: '1 TB SSD' } }),
    ]);
    expect(recommendations[0].productId).toBe('B');
    expect(recommendations[0].reason).toMatch(/32 GB RAM/);
  });

  test('an out-of-stock product drops below an in-stock one and says so', () => {
    const out = { scope: 'STORE', storeId: 'ST-1', quantityAvailable: 0, status: 'OUT_OF_STOCK' };
    const { recommendations } = rulesFor(
      'laptop',
      [product('A', { rating: 4.9, availability: out }), product('B', { rating: 4.0 })],
      { storeName: 'NovaMart Powai' }
    );
    expect(recommendations.map((r) => r.productId)).toEqual(['B', 'A']);
    expect(recommendations[1].reason).toMatch(/out of stock at NovaMart Powai/);
  });

  test('a required feature the product lacks sinks it', () => {
    const { recommendations } = rulesFor('5g phone', [
      product('A', { rating: 4.9, specifications: { '5g': false } }),
      product('B', { rating: 4.0, specifications: { '5g': true } }),
    ]);
    expect(recommendations[0]).toMatchObject({ productId: 'B' });
    expect(recommendations[0].reason).toMatch(/supports 5G/i);
  });

  test('variants of the same model appear once', () => {
    const { recommendations } = rulesFor('laptop', [
      product('A', { name: 'Zen 14 (8 GB, 256 GB)' }),
      product('B', { name: 'Zen 14 (16 GB, 512 GB)' }),
      product('C', { name: 'Flex 15 (8 GB, 512 GB)' }),
    ]);
    expect(recommendations).toHaveLength(2);
  });

  test('never returns more than the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => product(`P${i}`, { name: `Model ${i}` }));
    expect(rulesFor('laptop', many).recommendations).toHaveLength(3);
  });

  test('a vague request gets a question and no products', () => {
    const result = rulesFor('something nice', []);
    expect(result.recommendations).toEqual([]);
    expect(result.clarifyingQuestion).toMatch(/what kind of product/i);
  });

  test('no match gets a different question', () => {
    expect(rulesFor('flying car', []).clarifyingQuestion).toMatch(/could not find/i);
  });

  test('asks for a budget only when prices vary widely and none was given', () => {
    const spread = [
      product('A', { price: 30000, name: 'M1' }),
      product('B', { price: 200000, name: 'M2' }),
    ];
    expect(rulesFor('laptop for gaming', spread).clarifyingQuestion).toMatch(/budget/i);
    expect(rulesFor('laptop for gaming under 250000', spread).clarifyingQuestion).toBeNull();
  });

  test('says so when the budget had to be relaxed', () => {
    const result = rulesFor('laptop under 20000', [product('A')], { budgetRelaxed: true });
    expect(result.recommendations[0].reason).toMatch(/above your ₹20,000 budget/);
    expect(result.clarifyingQuestion).toMatch(/closest options/i);
  });
});

describe('model output handling', () => {
  const valid = {
    interpretedRequirement: 'A laptop for development',
    recommendations: [{ productId: 'A', reason: 'Plenty of RAM' }],
    clarifyingQuestion: null,
  };

  test('accepts plain JSON and JSON wrapped in a code fence', () => {
    expect(parseModelOutput(JSON.stringify(valid))).toEqual(valid);
    expect(parseModelOutput('```json\n' + JSON.stringify(valid) + '\n```')).toEqual(valid);
  });

  test.each([
    ['not JSON at all', 'Sure! I recommend the MacBook.'],
    ['missing fields', JSON.stringify({ recommendations: [] })],
    ['wrong types', JSON.stringify({ ...valid, recommendations: 'A' })],
    [
      'a reason that is empty',
      JSON.stringify({ ...valid, recommendations: [{ productId: 'A', reason: '' }] }),
    ],
    [
      'too many recommendations',
      JSON.stringify({ ...valid, recommendations: Array(9).fill(valid.recommendations[0]) }),
    ],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseModelOutput(raw)).toThrow();
  });

  test('grounding keeps real candidates in order and drops invented ids and repeats', () => {
    const candidates = [product('A'), product('B'), product('C')];
    const { kept, dropped } = groundRecommendations(
      [
        { productId: 'B', reason: 'r1' },
        { productId: 'MADE-UP-999', reason: 'r2' },
        { productId: 'B', reason: 'again' },
        { productId: 'A', reason: 'r3' },
        { productId: 'C', reason: 'r4' },
      ],
      candidates,
      2
    );
    expect(kept.map((k) => k.productId)).toEqual(['B', 'A']);
    expect(dropped).toEqual(['MADE-UP-999', 'B']);
  });
});
