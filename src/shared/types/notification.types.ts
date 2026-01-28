/**
 * Notification state type definitions.
 */

/**
 * Tracks notification state for a product/shop combination.
 */
export interface NotificationState {
  productId: string;
  shopId: string;
  lastNotified: Date | null;
  lastPrice: number | null;
  wasAvailable: boolean;
}
