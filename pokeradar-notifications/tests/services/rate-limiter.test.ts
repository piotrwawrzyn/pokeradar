import { RateLimiter } from '../../src/services/rate-limiter';

describe('RateLimiter', () => {
  it('allows immediate acquisition when tokens are available', async () => {
    const limiter = new RateLimiter(5, 1000);

    const start = Date.now();
    await limiter.acquire();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('allows multiple acquisitions up to the token limit', async () => {
    const limiter = new RateLimiter(3, 1000);

    const start = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('blocks when tokens are exhausted and waits for refill', async () => {
    const limiter = new RateLimiter(1, 200);

    await limiter.acquire(); // uses the only token

    const start = Date.now();
    await limiter.acquire(); // should wait ~200ms for refill
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(150);
    expect(elapsed).toBeLessThan(500);
  });

  it('refills tokens after the interval passes', async () => {
    const limiter = new RateLimiter(2, 200);

    await limiter.acquire();
    await limiter.acquire(); // exhausted

    await new Promise((resolve) => setTimeout(resolve, 250)); // wait for refill

    const start = Date.now();
    await limiter.acquire(); // should be immediate after refill
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});
