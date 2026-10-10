import {
  priceCart,
  STANDARD_DELIVERY_FEE,
  EXPRESS_DELIVERY_FEE,
} from '../../src/modules/cart/cart.pricing.js';

const line = (unitPrice, quantity = 1, mrp = unitPrice) => ({ unitPrice, quantity, mrp });

describe('priceCart', () => {
  test('totals quantities, subtotal and savings against MRP', () => {
    const { summary } = priceCart([line(1000, 2, 1200), line(250, 1, 250)], 'STANDARD');
    expect(summary.itemCount).toBe(3);
    expect(summary.distinctItems).toBe(2);
    expect(summary.subtotal).toBe(2250);
    expect(summary.mrpTotal).toBe(2650);
    expect(summary.productSavings).toBe(400);
  });

  test('an empty cart costs nothing to deliver', () => {
    const { summary, membership } = priceCart([], 'STANDARD');
    expect(summary.total).toBe(0);
    expect(summary.delivery.standard.fee).toBe(0);
    expect(membership.rewardPointsEarned).toBe(0);
  });

  test('STANDARD pays for delivery below Rs 499 and is told how much more to add', () => {
    const { summary } = priceCart([line(300)], 'STANDARD');
    expect(summary.delivery.standard.fee).toBe(STANDARD_DELIVERY_FEE);
    expect(summary.delivery.standard.amountToFree).toBe(200);
    expect(summary.total).toBe(300 + STANDARD_DELIVERY_FEE);
  });

  test('STANDARD gets free standard delivery above Rs 499 but always pays for express', () => {
    const { summary } = priceCart([line(5000)], 'STANDARD');
    expect(summary.delivery.standard.fee).toBe(0);
    expect(summary.delivery.standard.tierPerk).toBeNull();
    expect(summary.delivery.express.fee).toBe(EXPRESS_DELIVERY_FEE);
  });

  test('SILVER gets free express only above Rs 2,499', () => {
    expect(priceCart([line(2000)], 'SILVER').summary.delivery.express.fee).toBe(
      EXPRESS_DELIVERY_FEE
    );
    expect(priceCart([line(2500)], 'SILVER').summary.delivery.express.fee).toBe(0);
  });

  test.each(['GOLD', 'PLATINUM'])(
    '%s gets free standard and express on any order value',
    (tier) => {
      const { summary, membership } = priceCart([line(100)], tier);
      expect(summary.delivery.standard).toMatchObject({ fee: 0, free: true, tierPerk: tier });
      expect(summary.delivery.express).toMatchObject({ fee: 0, free: true, tierPerk: tier });
      expect(summary.total).toBe(100);
      expect(membership.deliverySavings).toBe(STANDARD_DELIVERY_FEE + EXPRESS_DELIVERY_FEE);
    }
  );

  test('reward points scale with the tier', () => {
    const points = (tier) => priceCart([line(1050)], tier).membership.rewardPointsEarned;
    expect(points('STANDARD')).toBe(10);
    expect(points('SILVER')).toBe(20);
    expect(points('GOLD')).toBe(30);
    expect(points('PLATINUM')).toBe(50);
  });

  test('an unknown tier falls back to STANDARD rather than granting perks', () => {
    const { summary, membership } = priceCart([line(100)], 'DIAMOND');
    expect(membership.tier).toBe('STANDARD');
    expect(summary.delivery.standard.fee).toBe(STANDARD_DELIVERY_FEE);
  });
});
