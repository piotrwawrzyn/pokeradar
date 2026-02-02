/**
 * Notification state type definitions.
 */

/**
 * Tracks notification state for a user/product/shop combination.
 */
export interface NotificationState {
  userId: string;
  productId: string;
  shopId: string;
  lastNotified: Date | null;
  lastPrice: number | null;
  wasAvailable: boolean;
}
