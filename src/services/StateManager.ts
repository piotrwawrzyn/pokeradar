import { NotificationState, ProductResult } from '../types';
import { Logger } from './Logger';

/**
 * Manages notification state to prevent spam and handle reset conditions.
 *
 * State reset conditions:
 * 1. Product becomes unavailable
 * 2. Price increases
 *
 * When state resets, the next time criteria is met, a notification will be sent.
 */
export class StateManager {
  private state: Map<string, NotificationState> = new Map();
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
   * Determines if a notification should be sent for this product/shop combination.
   */
  shouldNotify(productId: string, shopId: string, result: ProductResult): boolean {
    const key = this.getKey(productId, shopId);
    const prevState = this.state.get(key);

    // First time seeing this product - should notify
    if (!prevState || !prevState.lastNotified) {
      this.logger.debug('First time checking product, will notify if criteria met', {
        product: productId,
        shop: shopId
      });
      return true;
    }

    // Check reset conditions
    const shouldReset = this.checkResetConditions(prevState, result);

    if (shouldReset) {
      this.logger.info('State reset condition met', {
        product: productId,
        shop: shopId,
        reason: this.getResetReason(prevState, result)
      });
      this.resetState(key);
      return true;
    }

    // Already notified and no reset conditions met
    this.logger.debug('Already notified, no reset conditions met', {
      product: productId,
      shop: shopId,
      lastNotified: prevState.lastNotified
    });

    return false;
  }

  /**
   * Marks a product/shop combination as notified with current state.
   */
  markNotified(productId: string, shopId: string, result: ProductResult): void {
    const key = this.getKey(productId, shopId);

    this.state.set(key, {
      productId,
      shopId,
      lastNotified: new Date(),
      lastPrice: result.price,
      wasAvailable: result.isAvailable
    });

    this.logger.debug('Marked as notified', {
      product: productId,
      shop: shopId,
      price: result.price,
      available: result.isAvailable
    });
  }

  /**
   * Checks if any reset conditions are met.
   */
  private checkResetConditions(
    prevState: NotificationState,
    currentResult: ProductResult
  ): boolean {
    // Condition 1: Product became unavailable
    if (prevState.wasAvailable && !currentResult.isAvailable) {
      return true;
    }

    // Condition 2: Price increased
    if (
      prevState.lastPrice !== null &&
      currentResult.price !== null &&
      currentResult.price > prevState.lastPrice
    ) {
      return true;
    }

    return false;
  }

  /**
   * Gets the reason for state reset (for logging).
   */
  private getResetReason(
    prevState: NotificationState,
    currentResult: ProductResult
  ): string {
    if (prevState.wasAvailable && !currentResult.isAvailable) {
      return 'product_became_unavailable';
    }

    if (
      prevState.lastPrice !== null &&
      currentResult.price !== null &&
      currentResult.price > prevState.lastPrice
    ) {
      return `price_increased_from_${prevState.lastPrice}_to_${currentResult.price}`;
    }

    return 'unknown';
  }

  /**
   * Resets the notification state for a product/shop combination.
   */
  private resetState(key: string): void {
    this.state.delete(key);
  }

  /**
   * Gets the unique key for a product/shop combination.
   */
  private getKey(productId: string, shopId: string): string {
    return `${productId}:${shopId}`;
  }

  /**
   * Gets the current state for debugging/inspection.
   */
  getState(productId: string, shopId: string): NotificationState | undefined {
    const key = this.getKey(productId, shopId);
    return this.state.get(key);
  }

  /**
   * Clears all state (useful for testing).
   */
  clearAll(): void {
    this.state.clear();
    this.logger.info('All notification state cleared');
  }
}
