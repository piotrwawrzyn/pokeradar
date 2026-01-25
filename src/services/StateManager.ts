import { NotificationState, ProductResult } from '../types';
import { INotificationStateRepository } from '../repositories/interfaces';
import { Logger } from './Logger';

/**
 * Manages notification state to prevent spam and handle reset conditions.
 *
 * State reset conditions:
 * 1. Product becomes unavailable
 * 2. Price increases
 *
 * When state resets, the next time criteria is met, a notification will be sent.
 *
 * Supports both in-memory state and persistent MongoDB storage.
 */
export class StateManager {
  private state: Map<string, NotificationState> = new Map();
  private logger: Logger;
  private repository?: INotificationStateRepository;

  constructor(logger?: Logger, repository?: INotificationStateRepository) {
    this.logger = logger || new Logger();
    this.repository = repository;
  }

  /**
   * Loads state from repository into memory (call on startup if using persistence).
   */
  async loadFromRepository(): Promise<void> {
    if (!this.repository) return;

    const states = await this.repository.getAll();
    for (const state of states) {
      const key = this.getKey(state.productId, state.shopId);
      this.state.set(key, state);
    }
    this.logger.info(`Loaded ${states.length} notification states from repository`);
  }

  /**
   * Determines if a notification should be sent for this product/shop combination.
   */
  async shouldNotify(productId: string, shopId: string, result: ProductResult): Promise<boolean> {
    const key = this.getKey(productId, shopId);
    const prevState = this.state.get(key);

    // First time seeing this product - should notify
    if (!prevState || !prevState.lastNotified) {
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
      await this.resetState(key);
      return true;
    }

    // Already notified and no reset conditions met
    return false;
  }

  /**
   * Marks a product/shop combination as notified with current state.
   */
  async markNotified(productId: string, shopId: string, result: ProductResult): Promise<void> {
    const key = this.getKey(productId, shopId);

    const state: NotificationState = {
      productId,
      shopId,
      lastNotified: new Date(),
      lastPrice: result.price,
      wasAvailable: result.isAvailable
    };

    this.state.set(key, state);

    // Persist to repository if available
    if (this.repository) {
      await this.repository.set(state);
    }
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
  private async resetState(key: string): Promise<void> {
    this.state.delete(key);

    // Also delete from repository if available
    if (this.repository) {
      const [productId, shopId] = key.split(':');
      await this.repository.delete(productId, shopId);
    }
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
  async clearAll(): Promise<void> {
    this.state.clear();
    this.logger.info('All notification state cleared');
  }
}
