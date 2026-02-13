/**
 * Per-shop circuit breaker for scan cycles.
 * Tracks consecutive failures per shop and trips after a configurable threshold.
 * Instantiated per cycle and discarded after.
 */

export class ShopCircuitBreaker {
  private failureCounts = new Map<string, number>();
  private trippedShops = new Set<string>();

  constructor(private readonly threshold: number = 3) {}

  /**
   * Records a failure for a shop.
   * Returns true if the breaker just tripped on this call.
   */
  recordFailure(shopId: string): boolean {
    if (this.trippedShops.has(shopId)) {
      return false;
    }

    const count = (this.failureCounts.get(shopId) ?? 0) + 1;
    this.failureCounts.set(shopId, count);

    if (count >= this.threshold) {
      this.trippedShops.add(shopId);
      return true;
    }

    return false;
  }

  /**
   * Records a success for a shop. Resets the consecutive failure count.
   */
  recordSuccess(shopId: string): void {
    this.failureCounts.delete(shopId);
  }

  /**
   * Returns true if the breaker is tripped for this shop.
   */
  isTripped(shopId: string): boolean {
    return this.trippedShops.has(shopId);
  }

  /**
   * Returns all tripped shop IDs.
   */
  getTrippedShops(): string[] {
    return Array.from(this.trippedShops);
  }
}
