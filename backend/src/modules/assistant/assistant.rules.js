/**
 * Rule-based recommendation engine. Deterministic and explainable: it scores
 * the candidate products on facts (search relevance, specs that suit the
 * stated use, rating, stock, price against budget) and writes each reason
 * from those same facts.
 *
 * Used when no model API key is configured, and as the fallback when the
 * model fails or returns something unusable.
 */

/** Product types where "what will you use it for?" changes the answer. */
const USE_MATTERS = new Set([
  'laptops',
  'mobiles',
  'televisions',
  'audio',
  'refrigerators',
  'washing-machines',
  'air-conditioners',
]);

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const numberIn = (value) => {
  const match = String(value ?? '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
};

/**
 * Spec checks per use case: each returns a short reason when the product fits.
 * The reasons quote the product's own specification values.
 */
const SPEC_RULES = {
  development: (p) => {
    const ram = numberIn(p.specifications.ram);
    if (ram >= 16)
      return [3, `${p.specifications.ram} RAM handles an IDE, builds and containers together`];
    if (ram >= 8 && /ssd/i.test(p.specifications.storage ?? ''))
      return [1, `${p.specifications.ram} RAM and SSD storage are enough for light development`];
    return null;
  },
  gaming: (p) =>
    p.specifications.graphics
      ? [3, `dedicated ${p.specifications.graphics} graphics`]
      : /hz/i.test(p.specifications.display ?? '') || /gaming/i.test(p.name)
        ? [2, 'built for gaming']
        : null,
  student: (p) =>
    numberIn(p.specifications.weight) && numberIn(p.specifications.weight) <= 1.6
      ? [1, `light at ${p.specifications.weight}`]
      : null,
  office: (p) =>
    numberIn(p.specifications.weight) && numberIn(p.specifications.weight) <= 1.7
      ? [1, `easy to carry at ${p.specifications.weight}`]
      : null,
  creative: (p) =>
    /oled|retina|xdr/i.test(p.specifications.display ?? '')
      ? [2, `${p.specifications.display} display suits colour work`]
      : null,
  // A stated must-have: products without it are pushed down hard, not just unrewarded.
  '5g': (p) =>
    p.specifications['5g'] === true
      ? [3, 'supports 5G']
      : p.specifications['5g'] === false
        ? [-6, null]
        : null,
  camera: (p) =>
    numberIn(p.specifications.camera) >= 48 ? [2, `${p.specifications.camera} camera`] : null,
  battery: (p) => {
    const mah = numberIn(p.specifications.battery);
    const hours = numberIn(p.specifications.playback);
    if (mah >= 5000) return [2, `${p.specifications.battery} battery`];
    if (hours >= 30) return [2, `${p.specifications.playback} of playback`];
    return null;
  },
  energy: (p) => {
    const stars = numberIn(p.specifications.energyRating);
    return stars >= 4
      ? [3, `${p.specifications.energyRating} energy rating keeps running costs down`]
      : stars === 3
        ? [1, '3 Star energy rating']
        : null;
  },
  'small-room': (p) => {
    const capacity = p.specifications.capacity ?? '';
    if (/ton/i.test(capacity))
      return numberIn(capacity) <= 1 ? [3, `${capacity} capacity is right for a small room`] : null;
    if (/\bL\b/.test(capacity))
      return numberIn(capacity) <= 260 ? [2, `${capacity} is a compact size`] : null;
    if (/kg/i.test(capacity))
      return numberIn(capacity) <= 7 ? [2, `${capacity} drum suits one or two people`] : null;
    return null;
  },
  family: (p) => {
    const capacity = p.specifications.capacity ?? '';
    if (/\bL\b/.test(capacity))
      return numberIn(capacity) >= 300 ? [3, `${capacity} capacity suits a family`] : null;
    if (/kg/i.test(capacity))
      return numberIn(capacity) >= 8 ? [3, `${capacity} drum handles a family's laundry`] : null;
    if (/ton/i.test(capacity))
      return numberIn(capacity) >= 1.5 ? [2, `${capacity} cools a larger room`] : null;
    return null;
  },
  noise: (p) => (p.specifications.anc === true ? [3, 'active noise cancellation'] : null),
  running: (p) => (/running/i.test(p.name) ? [3, 'designed as a running shoe'] : null),
};

function scoreCandidate(product, intent, maxTextRank, priceCeiling) {
  const reasons = [];
  let score = 0;
  let disqualified = false;

  // How well the product's own text matches the shopper's words (0..3).
  if (maxTextRank > 0) score += (product.textRank / maxTextRank) * 3;

  for (const useCase of intent.useCases) {
    const hit = SPEC_RULES[useCase.id]?.(product);
    if (hit) {
      score += hit[0];
      if (hit[1]) reasons.push(hit[1]);
      // A negative hit means the product lacks something the shopper asked for by name.
      if (hit[0] < 0) disqualified = true;
    }
  }

  score += (product.rating - 3.5) * 1.5;
  if (product.rating >= 4.3)
    reasons.push(
      `rated ${product.rating.toFixed(1)} by ${product.ratingCount.toLocaleString('en-IN')} buyers`
    );

  const { status } = product.availability;
  if (status === 'OUT_OF_STOCK') score -= 4;
  if (status === 'LOW_STOCK') score -= 0.5;

  const { min, max } = intent.budget;
  if (max != null && product.price <= max) {
    reasons.push(`${inr(product.price)} is within your ${inr(max)} budget`);
    // Prefer using the budget well over the very cheapest item.
    score += (product.price / max) * 1.5;
  } else if (max != null) {
    // Over budget: the further over, the lower it ranks.
    score -= 3 + Math.min(3, product.price / max - 1);
    reasons.push(`${inr(product.price)} is above your ${inr(max)} budget`);
  } else if (min != null && product.price >= min) {
    reasons.push(`priced at ${inr(product.price)}`);
  }
  if (intent.pricePreference === 'low') score -= (product.price / priceCeiling) * 2;
  if (intent.pricePreference === 'high') score += (product.price / priceCeiling) * 2;

  if (product.mrp > product.price) {
    const off = Math.round(((product.mrp - product.price) / product.mrp) * 100);
    if (off >= 10) reasons.push(`${off}% off the MRP`);
  }

  return { product, score, reasons, disqualified };
}

function availabilityPhrase(availability, storeName) {
  const where = availability.scope === 'STORE' ? (storeName ?? 'your store') : null;
  if (availability.status === 'OUT_OF_STOCK')
    return where ? `currently out of stock at ${where}` : 'currently out of stock';
  if (availability.status === 'LOW_STOCK')
    return `only ${availability.quantityAvailable} left at ${where}`;
  return where ? `in stock at ${where}` : `in stock at ${availability.storesWithStock} locations`;
}

/**
 * @returns {{ recommendations: Array<{ productId: string, reason: string }>, clarifyingQuestion: string|null }}
 */
export function recommendByRules({ intent, candidates, limit, storeName, budgetRelaxed }) {
  if (intent.underspecified || candidates.length === 0) {
    return {
      recommendations: [],
      clarifyingQuestion: intent.underspecified
        ? 'What kind of product are you looking for, and roughly what is your budget?'
        : 'I could not find a match for that. Could you describe the product type, or try a different brand or budget?',
    };
  }

  const maxTextRank = Math.max(...candidates.map((c) => c.textRank), 0);
  const priceCeiling = Math.max(...candidates.map((c) => c.price), 1);
  const scored = candidates
    .map((c) => scoreCandidate(c, intent, maxTextRank, priceCeiling))
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id));

  // Products missing a must-have are only shown if nothing else qualifies.
  const qualified = scored.filter((entry) => !entry.disqualified);
  const ranked = qualified.length ? qualified : scored;

  // One variant per model line keeps the list varied ("... (8 GB, 128 GB)" vs "(8 GB, 256 GB)").
  const seenLines = new Set();
  const picked = [];
  for (const entry of ranked) {
    const line = `${entry.product.brand}|${entry.product.name.replace(/\s*\(.*\)\s*$/, '')}`;
    if (seenLines.has(line)) continue;
    seenLines.add(line);
    picked.push(entry);
    if (picked.length === limit) break;
  }

  const recommendations = picked.map(({ product, reasons }) => {
    const facts = reasons.length
      ? reasons.slice(0, 3)
      : [`a well-rated ${product.category.toLowerCase().replace(/s$/, '')} option`];
    const sentence = `${facts.join('; ')}; ${availabilityPhrase(product.availability, storeName)}.`;
    return { productId: product.id, reason: sentence.charAt(0).toUpperCase() + sentence.slice(1) };
  });

  // Ask a follow-up only when it would change the answer.
  let clarifyingQuestion = null;
  const prices = candidates.map((c) => c.price);
  const wideRange = Math.max(...prices) > Math.min(...prices) * 3;
  if (budgetRelaxed) {
    clarifyingQuestion =
      'Nothing matched within that budget, so these are the closest options. Would you like to raise the budget or look at a different type of product?';
  } else if (
    intent.budget.max == null &&
    intent.budget.min == null &&
    !intent.pricePreference &&
    wideRange
  ) {
    clarifyingQuestion = `What is your budget? These range from ${inr(Math.min(...prices))} to ${inr(Math.max(...prices))}.`;
  } else if (
    intent.categories.some((c) => USE_MATTERS.has(c)) &&
    intent.useCases.length === 0 &&
    candidates.length > limit * 2
  ) {
    clarifyingQuestion = 'What will you mainly use it for? That helps narrow these down.';
  }

  return { recommendations, clarifyingQuestion };
}
