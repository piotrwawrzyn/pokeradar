/**
 * Token bucket rate limiter for notification channels.
 * Ensures we stay within channel-specific rate limits (e.g., Telegram's 30 msgs/sec).
 */

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillIntervalMs: number
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Waits until a token is available, then consumes it.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Wait for next refill
    const waitTime = this.refillIntervalMs - (Date.now() - this.lastRefill);
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.refill();
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed >= this.refillIntervalMs) {
      this.tokens = this.maxTokens;
      this.lastRefill = now;
    }
  }
}
