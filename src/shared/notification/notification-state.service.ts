/**
 * Notification state manager service.
 * Manages state to prevent notification spam and handle reset conditions.
 */

import { NotificationState, ProductResult } from '../types';
import { ILogger } from '../logger';

/**
 * Repository interface for notification state persistence.
 */
export interface INotificationStateRepository {
  getAll(): Promise<NotificationState[]>;
  setBatch(states: NotificationState[]): Promise<void>;
  deleteBatch(keys: Array<{ productId: string; shopId: string }>): Promise<void>;
}

/**
 * Manages notification state to prevent spam and handle reset conditions.
 *
 * State reset conditions:
 * 1. Product becomes unavailable
 * 2. Price increases
 *
 * Supports both in-memory state and persistent MongoDB storage.
 * Buffers changes for batch persistence to minimize DB operations.
 */
export class NotificationStateService {
  private state: Map<string, NotificationState> = new Map();
  private pendingUpserts: Map<string, NotificationState> = new Map();
  private pendingDeletes: Set<string> = new Set();

  constructor(
    private logger?: ILogger,
    private repository?: INotificationStateRepository
  ) {}

  /**
   * Loads state from repository into memory.
   */
  async loadFromRepository(): Promise<void> {
    if (!this.repository) return;

    const states = await this.repository.getAll();
    for (const state of states) {
      const key = this.getKey(state.productId, state.shopId);
      this.state.set(key, state);
    }
    this.logger?.info(`Loaded ${states.length} notification states from repository`);
  }

  /**
   * Determines if a notification should be sent for this product/shop combination.
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
   */
  markNotified(productId: string, shopId: string, result: ProductResult): void {
    const key = this.getKey(productId, shopId);

    const state: NotificationState = {
      productId,
      shopId,
      lastNotified: new Date(),
      lastPrice: result.price,
      wasAvailable: result.isAvailable,
    };

    this.state.set(key, state);

    // Buffer for batch persistence
    this.pendingDeletes.delete(key);
    this.pendingUpserts.set(key, state);
  }

  /**
   * Updates tracked state for a product/shop (called on every scan).
   * Enables reset condition detection.
   */
  updateTrackedState(productId: string, shopId: string, result: ProductResult): void {
    const key = this.getKey(productId, shopId);
    const prevState = this.state.get(key);

    if (!prevState || !prevState.lastNotified) {
      return;
    }

    const shouldReset = this.checkResetConditions(prevState, result);

    if (shouldReset) {
      this.logger?.info('State reset condition met', {
        product: productId,
        shop: shopId,
        reason: this.getResetReason(prevState, result),
      });
      this.resetState(key);
    }
  }

  /**
   * Flushes all buffered state changes to the repository.
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
      if (upsertCount > 0) {
        await this.repository.setBatch(Array.from(this.pendingUpserts.values()));
      }

      if (deleteCount > 0) {
        const keysToDelete = Array.from(this.pendingDeletes).map((key) => {
          const [productId, shopId] = key.split(':');
          return { productId, shopId };
        });
        await this.repository.deleteBatch(keysToDelete);
      }

      this.logger?.info('Flushed notification state changes', {
        upserts: upsertCount,
        deletes: deleteCount,
      });
    } finally {
      this.clearBuffers();
    }
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
    this.logger?.info('All notification state cleared');
  }

  private checkResetConditions(
    prevState: NotificationState,
    currentResult: ProductResult
  ): boolean {
    // Product became unavailable
    if (prevState.wasAvailable && !currentResult.isAvailable) {
      return true;
    }

    // Price increased
    if (
      prevState.lastPrice !== null &&
      currentResult.price !== null &&
      currentResult.price > prevState.lastPrice
    ) {
      return true;
    }

    return false;
  }

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

  private resetState(key: string): void {
    this.state.delete(key);
    this.pendingUpserts.delete(key);
    this.pendingDeletes.add(key);
  }

  private clearBuffers(): void {
    this.pendingUpserts.clear();
    this.pendingDeletes.clear();
  }

  private getKey(productId: string, shopId: string): string {
    return `${productId}:${shopId}`;
  }
}
