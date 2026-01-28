/**
 * Notification state repository interface.
 */

import { NotificationState } from '../../types';

/**
 * Repository interface for notification state persistence.
 * Key format: {productId}:{shopId}
 */
export interface INotificationStateRepository {
  get(productId: string, shopId: string): Promise<NotificationState | null>;
  set(state: NotificationState): Promise<void>;
  /** Batch upsert multiple states in a single operation */
  setBatch(states: NotificationState[]): Promise<void>;
  delete(productId: string, shopId: string): Promise<void>;
  /** Batch delete multiple states in a single operation */
  deleteBatch(keys: Array<{ productId: string; shopId: string }>): Promise<void>;
  getAll(): Promise<NotificationState[]>;
}
