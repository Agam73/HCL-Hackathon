/**
 * Turns a shopper's free text into structured intent: product type, brands,
 * budget, what it is for. Pure functions, no I/O.
 *
 * This runs before any model call. It decides which catalogue products are
 * even eligible (so the model can only pick from real, in-range products) and
 * it powers the rule-based engine used when no model is configured.
 */

/** Words that say what kind of product is wanted -> category slug. */
const CATEGORY_TERMS = {
  laptops: ['laptop', 'laptops', 'notebook', 'macbook', 'ultrabook', 'chromebook'],
  mobiles: [
    'phone',
    'phones',
    'mobile',
    'mobiles',
    'smartphone',
    'smartphones',
    'iphone',
    'android',
  ],
  televisions: ['tv', 'tvs', 'television', 'televisions', 'oled', 'qled'],
  audio: [
    'headphone',
    'headphones',
    'earbuds',
    'earphones',
    'earphone',
    'speaker',
    'speakers',
    'soundbar',
    'neckband',
    'airpods',
    'headset',
  ],
  refrigerators: ['fridge', 'fridges', 'refrigerator', 'refrigerators'],
  'washing-machines': ['washer', 'washing', 'laundry'],
  'air-conditioners': ['ac', 'acs', 'conditioner', 'conditioners', 'aircon'],
  'kitchen-appliances': [
    'mixer',
    'grinder',
    'kettle',
    'fryer',
    'microwave',
    'oven',
    'otg',
    'induction',
    'cooktop',
    'cooker',
    'blender',
    'toaster',
  ],
  footwear: [
    'shoe',
    'shoes',
    'sneaker',
    'sneakers',
    'sandal',
    'sandals',
    'slides',
    'footwear',
    'trainers',
  ],
  apparel: [
    'jeans',
    'shirt',
    'shirts',
    'tshirt',
    'tee',
    'hoodie',
    'jacket',
    'trousers',
    'chinos',
    'polo',
    'clothes',
    'clothing',
  ],
  'packaged-foods': [
    'rice',
    'dal',
    'atta',
    'flour',
    'oil',
    'oats',
    'honey',
    'almonds',
    'cashews',
    'walnuts',
    'besan',
    'chana',
    'groceries',
    'grocery',
  ],
  beverages: ['tea', 'coffee', 'juice', 'chai', 'beverage', 'beverages', 'drink', 'drinks'],
};

/**
 * What the product is for ("for gaming") or must have (feature: "with 5G").
 * Each one adds search terms and a short phrase for explanations.
 */
const USE_CASES = [
  {
    id: 'development',
    phrase: 'software development',
    match:
      /\b(java|python|coding|programming|developer|development|software|devops|android studio|ide)\b/,
    terms: ['developer', 'programming', 'development'],
  },
  { id: 'gaming', phrase: 'gaming', match: /\b(gaming|gamer|games|esports)\b/, terms: ['gaming'] },
  {
    id: 'student',
    phrase: 'study and everyday use',
    match: /\b(student|students|college|school|study|studies)\b/,
    terms: ['student'],
  },
  {
    id: 'office',
    phrase: 'office work',
    match: /\b(office|business|work from home|wfh|spreadsheets?|meetings?)\b/,
    terms: ['office', 'business'],
  },
  {
    id: 'creative',
    phrase: 'creative work',
    match: /\b(video editing|photo editing|editing|design|designer|creator|content creation)\b/,
    terms: ['creator'],
  },
  {
    id: 'running',
    phrase: 'running',
    match: /\b(running|run|jogging|jog|marathon|gym|workout|training)\b/,
    terms: ['running', 'sports', 'gym'],
  },
  { id: '5g', feature: true, phrase: '5G', match: /\b5g\b/, terms: ['5g'] },
  {
    id: 'camera',
    feature: true,
    phrase: 'a good camera',
    match: /\b(camera|photos?|photography|selfies?)\b/,
    terms: ['camera'],
  },
  {
    id: 'battery',
    feature: true,
    phrase: 'long battery life',
    match: /\b(battery|all[- ]day|long lasting)\b/,
    terms: ['battery'],
  },
  {
    id: 'energy',
    feature: true,
    phrase: 'low running cost',
    match: /\b(energy[- ]efficient|power saving|low electricity|efficient|inverter|5 star)\b/,
    terms: ['inverter', 'energy'],
  },
  { id: 'family', phrase: 'a family', match: /\b(family|large family|joint family)\b/, terms: [] },
  {
    id: 'small-room',
    phrase: 'a small room',
    match: /\b(small room|bedroom|small bedroom|compact|single person|bachelor)\b/,
    terms: [],
  },
  {
    id: 'noise',
    feature: true,
    phrase: 'noise cancelling',
    match: /\b(noise[- ]cancell?ing|anc|commute|travel|flights?)\b/,
    terms: ['noise', 'cancelling'],
  },
];

const STOPWORDS = new Set(
  `a an the and or but for of to in on at by with from into is are was be been am i me my we our you your
   it its this that these those need needs want wants looking look find buy get getting show suggest recommend
   recommendation recommendations please can could would should some any something good best nice great
   really very which what who whom mom mum dad mother father wife husband son daughter kid kids friend gift
   under below less than within upto up max maximum budget around about between rs inr rupees price priced
   cost costs cheap cheapest affordable premium use using used daily everyday new one ones like prefer
   do does did have has had not no yes so if then there here how when where why will shall may might also
   just only more most much many tell give help hi hello hey thanks thank ok okay as all too me us them they
   he she his her their options option thing things stuff item items product products`
    .split(/\s+/)
    .filter(Boolean)
);

const PRICE_WORDS = {
  cheap: 'low',
  cheapest: 'low',
  affordable: 'low',
  budget: 'low',
  inexpensive: 'low',
  premium: 'high',
  flagship: 'high',
  luxury: 'high',
};

const normalise = (text) =>
  text
    .toLowerCase()
    .replace(/[₹,]/g, (ch) => (ch === ',' ? '' : ' rs '))
    .replace(/t-shirt/g, 'tshirt');

/** "50k" / "1.5 lakh" / "20000" -> rupees. */
function toRupees(number, unit) {
  const value = Number(number);
  if (!Number.isFinite(value)) return null;
  if (/^k$/.test(unit ?? '')) return Math.round(value * 1000);
  if (/^(l|lac|lacs|lakh|lakhs)$/.test(unit ?? '')) return Math.round(value * 100000);
  return Math.round(value);
}

const AMOUNT = String.raw`(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(k|lakhs?|lacs?|l)?\b`;

export function parseBudget(rawText) {
  const text = normalise(rawText);
  const range = text.match(new RegExp(String.raw`between\s+${AMOUNT}\s+(?:and|to|-)\s+${AMOUNT}`));
  if (range) {
    const [a, b] = [toRupees(range[1], range[2] ?? range[4]), toRupees(range[3], range[4])];
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const upper = text.match(
    new RegExp(
      String.raw`(?:under|below|less than|within|upto|up to|max(?:imum)?|not more than|budget(?: of| is)?)\s+${AMOUNT}`
    )
  );
  if (upper) return { min: null, max: toRupees(upper[1], upper[2]) };
  const lower = text.match(
    new RegExp(String.raw`(?:above|over|more than|at least|min(?:imum)?)\s+${AMOUNT}`)
  );
  if (lower) return { min: toRupees(lower[1], lower[2]), max: null };
  const around = text.match(
    new RegExp(String.raw`(?:around|about|approx(?:imately)?|near)\s+${AMOUNT}`)
  );
  if (around) {
    const mid = toRupees(around[1], around[2]);
    return { min: Math.round(mid * 0.8), max: Math.round(mid * 1.2) };
  }
  return { min: null, max: null };
}

/**
 * @param {string} query the shopper's words
 * @param {Array<{ id: string, name: string }>} brands every brand in the catalogue
 */
export function parseIntent(query, brands = []) {
  const text = normalise(query);
  const words = text.match(/[a-z0-9]+/g) ?? [];
  const wordSet = new Set(words);

  const categories = Object.entries(CATEGORY_TERMS)
    .filter(([, terms]) => terms.some((t) => wordSet.has(t)))
    .map(([slug]) => slug);
  // "washing machine" / "air conditioner" are two words; "washing" alone is enough above.

  const brandIds = brands
    .filter((b) => {
      const name = b.name.toLowerCase().replace(/[^a-z0-9 ]/g, '');
      const plain = text.replace(/['’]/g, '').replace(/[^a-z0-9 ]/g, ' ');
      // "NovaMart Essentials" should not match the store's own name in passing.
      return name.length > 1 && new RegExp(`\\b${name.replace(/ /g, '\\s+')}\\b`).test(plain);
    })
    .map((b) => b.id);
  const brandWords = new Set(
    brands
      .filter((b) => brandIds.includes(b.id))
      .flatMap((b) => b.name.toLowerCase().match(/[a-z0-9]+/g) ?? [])
  );

  const useCases = USE_CASES.filter((u) => u.match.test(text));
  const budget = parseBudget(query);
  const pricePreference = words.map((w) => PRICE_WORDS[w]).find(Boolean) ?? null;

  const categoryWords = new Set(Object.values(CATEGORY_TERMS).flat());
  const keywords = [
    ...new Set([
      ...words.filter(
        (w) =>
          w.length > 1 &&
          !STOPWORDS.has(w) &&
          !/^\d+$/.test(w) &&
          !/^(k|lakh|lakhs|lac|lacs)$/.test(w) &&
          !brandWords.has(w)
      ),
      ...useCases.flatMap((u) => u.terms),
    ]),
  ];
  const descriptive = keywords.filter((w) => !categoryWords.has(w));

  return {
    categories,
    brandIds,
    budget,
    pricePreference,
    useCases: useCases.map((u) => ({ id: u.id, phrase: u.phrase, feature: Boolean(u.feature) })),
    keywords,
    // Nothing to search on: no product type, no brand, and no descriptive word either.
    underspecified: categories.length === 0 && brandIds.length === 0 && descriptive.length === 0,
  };
}

const CATEGORY_NOUN = {
  laptops: 'laptop',
  mobiles: 'phone',
  televisions: 'TV',
  audio: 'audio product',
  refrigerators: 'refrigerator',
  'washing-machines': 'washing machine',
  'air-conditioners': 'air conditioner',
  'kitchen-appliances': 'kitchen appliance',
  footwear: 'pair of shoes',
  apparel: 'clothing item',
  'packaged-foods': 'grocery item',
  beverages: 'beverage',
};

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/** One sentence saying what we understood - shown to the shopper as the explanation. */
export function describeIntent(intent, { brandNames = [], storeName } = {}) {
  const noun = intent.categories.length
    ? intent.categories.map((c) => CATEGORY_NOUN[c] ?? c).join(' or ')
    : intent.keywords.length
      ? `product matching "${intent.keywords.slice(0, 4).join(' ')}"`
      : 'product';
  const subject = brandNames.length ? `${brandNames.join(' / ')} ${noun}` : noun;
  const parts = [`${/^[aeiou]/i.test(subject) ? 'An' : 'A'} ${subject}`];
  const purposes = intent.useCases.filter((u) => !u.feature).map((u) => u.phrase);
  const features = intent.useCases.filter((u) => u.feature).map((u) => u.phrase);
  let subjectLine = parts[0];
  if (features.length) subjectLine += ` with ${features.join(' and ')}`;
  if (purposes.length) subjectLine += ` for ${purposes.join(' and ')}`;
  parts[0] = subjectLine;
  const { min, max } = intent.budget;
  if (min != null && max != null) parts.push(`priced between ${inr(min)} and ${inr(max)}`);
  else if (max != null) parts.push(`priced up to ${inr(max)}`);
  else if (min != null) parts.push(`priced from ${inr(min)}`);
  else if (intent.pricePreference === 'low') parts.push('at a low price');
  else if (intent.pricePreference === 'high') parts.push('from the premium range');
  if (storeName) parts.push(`with stock checked at ${storeName}`);
  return `${parts.join(', ')}.`;
}
