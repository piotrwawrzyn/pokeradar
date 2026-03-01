import { ShopCircuitBreaker } from '../shop-circuit-breaker';

describe('ShopCircuitBreaker', () => {
  describe('initial state', () => {
    it('is not tripped for any shop', () => {
      const breaker = new ShopCircuitBreaker();
      expect(breaker.isTripped('shop-a')).toBe(false);
    });

    it('returns empty tripped shops list', () => {
      expect(new ShopCircuitBreaker().getTrippedShops()).toEqual([]);
    });
  });

  describe('recordFailure()', () => {
    it('returns false before the threshold is reached', () => {
      const breaker = new ShopCircuitBreaker(3);
      expect(breaker.recordFailure('shop-a')).toBe(false);
      expect(breaker.recordFailure('shop-a')).toBe(false);
    });

    it('returns true and trips when threshold is reached', () => {
      const breaker = new ShopCircuitBreaker(3);
      breaker.recordFailure('shop-a');
      breaker.recordFailure('shop-a');
      const tripped = breaker.recordFailure('shop-a');
      expect(tripped).toBe(true);
      expect(breaker.isTripped('shop-a')).toBe(true);
    });

    it('returns false on subsequent calls after already tripped', () => {
      const breaker = new ShopCircuitBreaker(1);
      breaker.recordFailure('shop-a'); // trips
      expect(breaker.recordFailure('shop-a')).toBe(false);
    });

    it('tracks failure counts independently per shop', () => {
      const breaker = new ShopCircuitBreaker(2);
      breaker.recordFailure('shop-a');
      breaker.recordFailure('shop-b');
      // shop-a needs one more
      expect(breaker.isTripped('shop-a')).toBe(false);
      breaker.recordFailure('shop-a');
      expect(breaker.isTripped('shop-a')).toBe(true);
      expect(breaker.isTripped('shop-b')).toBe(false);
    });

    it('uses threshold of 3 by default', () => {
      const breaker = new ShopCircuitBreaker();
      breaker.recordFailure('shop');
      breaker.recordFailure('shop');
      expect(breaker.isTripped('shop')).toBe(false);
      breaker.recordFailure('shop');
      expect(breaker.isTripped('shop')).toBe(true);
    });
  });

  describe('recordSuccess()', () => {
    it('resets failure count so threshold restarts from zero', () => {
      const breaker = new ShopCircuitBreaker(3);
      breaker.recordFailure('shop-a');
      breaker.recordFailure('shop-a');
      breaker.recordSuccess('shop-a');
      // counter reset — two more failures still below threshold
      expect(breaker.recordFailure('shop-a')).toBe(false);
      expect(breaker.recordFailure('shop-a')).toBe(false);
      expect(breaker.isTripped('shop-a')).toBe(false);
    });

    it('is a no-op for a shop with no recorded failures', () => {
      const breaker = new ShopCircuitBreaker();
      expect(() => breaker.recordSuccess('unknown-shop')).not.toThrow();
    });
  });

  describe('getTrippedShops()', () => {
    it('lists all tripped shops', () => {
      const breaker = new ShopCircuitBreaker(1);
      breaker.recordFailure('shop-a');
      breaker.recordFailure('shop-b');
      expect(breaker.getTrippedShops()).toEqual(expect.arrayContaining(['shop-a', 'shop-b']));
      expect(breaker.getTrippedShops()).toHaveLength(2);
    });

    it('does not include shops that have not tripped', () => {
      const breaker = new ShopCircuitBreaker(2);
      breaker.recordFailure('shop-a'); // not yet tripped
      expect(breaker.getTrippedShops()).toHaveLength(0);
    });
  });
});
