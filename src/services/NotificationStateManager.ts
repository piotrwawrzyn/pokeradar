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
 * Buffers changes for batch persistence to minimize DB operations.
 */
export class NotificationStateManager {
  private state: Map<string, NotificationState> = new Map();
  private logger: Logger;
  private repository?: INotificationStateRepository;

  /** Buffer for states to upsert at end of scan cycle */
  private pendingUpserts: Map<string, NotificationState> = new Map();
  /** Buffer for keys to delete at end of scan cycle */
  private pendingDeletes: Set<string> = new Set();

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
   * Reset conditions are now handled by updateTrackedState() which should be
   * called on every scan.
   */
  shouldNotify(productId: string, shopId: string): boolean {
    const key = this.getKey(productId, shopId);
    const prevState = this.state.get(key);

    // No previous notification - should notify
    if (!prevState || !prevState.lastNotified) {
      return true;
    }

    // Already notified and state hasn't been reset
    return false;
  }

  /**
   * Marks a product/shop combination as notified with current state.
   * Buffers the change for batch persistence - call flushChanges() at end of cycle.
   */
  markNotified(productId: string, shopId: string, result: ProductResult): void {
    const key = this.getKey(productId, shopId);

    const state: NotificationState = {
      productId,
      shopId,
      lastNotified: new Date(),
      lastPrice: result.price,
      wasAvailable: result.isAvailable
    };

    this.state.set(key, state);

    // Buffer for batch persistence
    this.pendingDeletes.delete(key); // Cancel any pending delete
    this.pendingUpserts.set(key, state);
  }

  /**
   * Updates tracked state for a product/shop (called on every scan).
   * This enables reset condition detection when product becomes unavailable
   * or price increases - even when notification criteria aren't met.
   * Buffers changes for batch persistence - call flushChanges() at end of cycle.
   */
  updateTrackedState(productId: string, shopId: string, result: ProductResult): void {
    const key = this.getKey(productId, shopId);
    const prevState = this.state.get(key);

    // No previous state - nothing to track yet
    if (!prevState || !prevState.lastNotified) {
      return;
    }

    // Check if reset conditions are met
    const shouldReset = this.checkResetConditions(prevState, result);

    if (shouldReset) {
      this.logger.info('State reset condition met', {
        product: productId,
        shop: shopId,
        reason: this.getResetReason(prevState, result)
      });
      this.resetState(key);
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
   * Buffers the change for batch persistence - call flushChanges() at end of cycle.
   */
  private resetState(key: string): void {
    this.state.delete(key);

    // Buffer for batch persistence
    this.pendingUpserts.delete(key); // Cancel any pending upsert
    this.pendingDeletes.add(key);
  }

  /**
   * Flushes all buffered state changes to the repository.
   * Call this at the end of a scan cycle to batch all DB operations.
   */
  async flushChanges(): Promise<void> {
    if (!this.repository) {
      this.clearBuffers();
      return;
    }

    const upsertCount = this.pendingUpserts.size;
    const deleteCount = this.pendingDeletes.size;

    if (upsertCount === 0 && deleteCount === 0) {
      return;
    }

    try {
      // Batch upsert all pending states
      if (upsertCount > 0) {
        await this.repository.setBatch(Array.from(this.pendingUpserts.values()));
      }

      // Batch delete all pending deletes
      if (deleteCount > 0) {
        const keysToDelete = Array.from(this.pendingDeletes).map(key => {
          const [productId, shopId] = key.split(':');
          return { productId, shopId };
        });
        await this.repository.deleteBatch(keysToDelete);
      }

      this.logger.info('Flushed notification state changes', {
        upserts: upsertCount,
        deletes: deleteCount
      });
    } finally {
      this.clearBuffers();
    }
  }

  /**
   * Clears the pending change buffers.
   */
  private clearBuffers(): void {
    this.pendingUpserts.clear();
    this.pendingDeletes.clear();
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
