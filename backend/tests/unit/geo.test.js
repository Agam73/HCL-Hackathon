import { distanceKm } from '../../src/utils/geo.js';

const connaughtPlace = { latitude: 28.631451, longitude: 77.216675 };
const cyberHub = { latitude: 28.495, longitude: 77.089 };
const andheri = { latitude: 19.136, longitude: 72.826 };

describe('distanceKm', () => {
  test('is zero between a point and itself', () => {
    expect(distanceKm(connaughtPlace, connaughtPlace)).toBe(0);
  });

  test('Connaught Place to Cyber Hub is about 20 km', () => {
    const km = distanceKm(connaughtPlace, cyberHub);
    expect(km).toBeGreaterThan(18);
    expect(km).toBeLessThan(22);
  });

  test('Delhi to Mumbai is about 1,150 km and symmetric', () => {
    const km = distanceKm(connaughtPlace, andheri);
    expect(km).toBeGreaterThan(1100);
    expect(km).toBeLessThan(1200);
    expect(distanceKm(andheri, connaughtPlace)).toBe(km);
  });

  test('returns null when a point has no coordinates', () => {
    expect(distanceKm(connaughtPlace, { latitude: null, longitude: null })).toBeNull();
    expect(distanceKm(null, cyberHub)).toBeNull();
  });
});
