/**
 * Pure cart maths - no database access, so it is unit-testable on its own.
 *
 * The numbers come from the policy documents in db/seed/knowledge-base
 * (membership-benefits.md, shipping-and-delivery-policy.md). If a policy
 * changes, change it here and in the document together.
 *
 * Delivery fees assume a metro zone: every seeded store is in one.
 */
export const STANDARD_DELIVERY_FEE = 49;
export const EXPRESS_DELIVERY_FEE = 149;
export const POINT_VALUE_INR = 0.25;
export const MAX_QUANTITY_PER_ITEM = 10;

/** freeStandardAbove / freeExpressAbove: 0 = always free, null = never free. */
export const TIER_BENEFITS = {
  STANDARD: {
    pointsPer100: 1,
    freeStandardAbove: 499,
    freeExpressAbove: null,
    returnWindowDays: 7,
  },
  SILVER: { pointsPer100: 2, freeStandardAbove: 499, freeExpressAbove: 2499, returnWindowDays: 10 },
  GOLD: { pointsPer100: 3, freeStandardAbove: 0, freeExpressAbove: 0, returnWindowDays: 15 },
  PLATINUM: { pointsPer100: 5, freeStandardAbove: 0, freeExpressAbove: 0, returnWindowDays: 15 },
};

const round2 = (n) => Math.round(n * 100) / 100;

function deliveryOption(baseFee, freeAbove, subtotal, tier) {
  const free = freeAbove !== null && subtotal > freeAbove;
  const alwaysFree = freeAbove === 0;
  return {
    fee: free ? 0 : baseFee,
    baseFee,
    free,
    // Set when the waiver is a membership benefit rather than an order-value rule.
    tierPerk: free && alwaysFree ? tier : null,
    freeAbove,
    amountToFree: free || freeAbove === null ? null : round2(freeAbove - subtotal + 1),
  };
}

/**
 * @param {Array<{ unitPrice: number, mrp: number|null, quantity: number }>} lines
 * @param {string} tier membership tier of the cart owner
 */
export function priceCart(lines, tier) {
  const benefits = TIER_BENEFITS[tier] ?? TIER_BENEFITS.STANDARD;
  const appliedTier = TIER_BENEFITS[tier] ? tier : 'STANDARD';

  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = round2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  const mrpTotal = round2(lines.reduce((sum, l) => sum + (l.mrp ?? l.unitPrice) * l.quantity, 0));

  const empty = itemCount === 0;
  const free = {
    fee: 0,
    baseFee: 0,
    free: false,
    tierPerk: null,
    freeAbove: null,
    amountToFree: null,
  };
  const standard = empty
    ? free
    : deliveryOption(STANDARD_DELIVERY_FEE, benefits.freeStandardAbove, subtotal, appliedTier);
  const express = empty
    ? free
    : deliveryOption(EXPRESS_DELIVERY_FEE, benefits.freeExpressAbove, subtotal, appliedTier);

  const rewardPoints = Math.floor(subtotal / 100) * benefits.pointsPer100;

  return {
    summary: {
      itemCount,
      distinctItems: lines.length,
      mrpTotal,
      subtotal,
      productSavings: round2(mrpTotal - subtotal),
      delivery: { standard, express },
      // Standard home delivery is the default; pickup and express are chosen at checkout.
      total: round2(subtotal + standard.fee),
      currency: 'INR',
    },
    membership: {
      tier: appliedTier,
      rewardPointsPer100: benefits.pointsPer100,
      rewardPointsEarned: rewardPoints,
      rewardPointsValue: round2(rewardPoints * POINT_VALUE_INR),
      returnWindowDays: benefits.returnWindowDays,
      deliverySavings: round2(
        (standard.tierPerk ? standard.baseFee : 0) + (express.tierPerk ? express.baseFee : 0)
      ),
      perks: describePerks(appliedTier, benefits),
    },
  };
}

/** Human-readable perk list for the cart and profile screens. */
export function describePerks(tier, benefits = TIER_BENEFITS[tier]) {
  const inr = (n) => `₹${n.toLocaleString('en-IN')}`;
  return [
    benefits.freeStandardAbove === 0
      ? 'Free standard delivery on every order'
      : `Free standard delivery above ${inr(benefits.freeStandardAbove)}`,
    benefits.freeExpressAbove === 0
      ? 'Free express delivery on every order'
      : benefits.freeExpressAbove === null
        ? `Express delivery at ${inr(EXPRESS_DELIVERY_FEE)}`
        : `Free express delivery above ${inr(benefits.freeExpressAbove)}`,
    `${benefits.pointsPer100} reward point${benefits.pointsPer100 > 1 ? 's' : ''} per ₹100 spent`,
    `${benefits.returnWindowDays}-day return window`,
  ];
}
