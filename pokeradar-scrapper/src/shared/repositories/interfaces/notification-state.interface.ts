/**
 * Notification state repository interface.
 */

import { NotificationState } from '../../types';

/**
 * Repository interface for notification state persistence.
 * Key format: {userId}:{productId}:{shopId}
 */
export interface INotificationStateRepository {
  get(userId: string, productId: string, shopId: string): Promise<NotificationState | null>;
  set(state: NotificationState): Promise<void>;
  /** Batch upsert multiple states in a single operation */
  setBatch(states: NotificationState[]): Promise<void>;
  delete(userId: string, productId: string, shopId: string): Promise<void>;
  /** Batch delete multiple states in a single operation */
  deleteBatch(keys: Array<{ userId: string; productId: string; shopId: string }>): Promise<void>;
  /** Load all states, optionally filtered to specific product IDs */
  getAll(productIds?: string[]): Promise<NotificationState[]>;
}
