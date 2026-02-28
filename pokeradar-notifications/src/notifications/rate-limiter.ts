/**
 * Token bucket rate limiter with continuous refill for notification channels.
 * Ensures we stay within channel-specific rate limits (e.g., Telegram's 30 msgs/sec).
 *
 * Tokens regenerate continuously (one every `refillIntervalMs / maxTokens` ms)
 * instead of refilling all at once. Concurrent callers are serialized via a
 * promise-based waiter queue — JS single-threaded event loop guarantees no races.
 */

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly msPerToken: number;
  private waiters: Array<() => void> = [];
  private timerActive = false;

  constructor(
    private maxTokens: number,
    private refillIntervalMs: number,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
    this.msPerToken = refillIntervalMs / maxTokens;
  }

  /**
   * Waits until a token is available, then consumes it.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }

    // No tokens available — queue the caller
    return new Promise<void>((resolve) => {
      this.waiters.push(resolve);
      this.ensureTimer();
    });
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = Math.floor(elapsed / this.msPerToken);

    if (newTokens > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
      // Advance lastRefill by exactly the consumed time to avoid drift
      this.lastRefill += newTokens * this.msPerToken;
    }
  }

  private ensureTimer(): void {
    if (this.timerActive) return;
    this.timerActive = true;
    this.scheduleRefill();
  }

  private scheduleRefill(): void {
    setTimeout(() => {
      this.refill();

      // Drain as many waiters as we have tokens
      while (this.tokens >= 1 && this.waiters.length > 0) {
        this.tokens--;
        const next = this.waiters.shift()!;
        next();
      }

      if (this.waiters.length > 0) {
        this.scheduleRefill();
      } else {
        this.timerActive = false;
      }
    }, Math.ceil(this.msPerToken));
  }
}
