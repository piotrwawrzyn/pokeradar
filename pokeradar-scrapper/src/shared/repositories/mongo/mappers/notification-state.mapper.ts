/**
 * Mapper for NotificationState document to domain model conversion.
 */

import { NotificationState } from '../../../types';

/**
 * NotificationState document interface (from MongoDB).
 */
export interface INotificationStateDoc {
  key: string; // {userId}:{productId}:{shopId}
  userId: string;
  productId: string;
  shopId: string;
  lastNotified: Date | null;
  lastPrice: number | null;
  wasAvailable: boolean;
  updatedAt?: Date;
}

/**
 * Generates a composite key for notification state.
 */
export function getStateKey(userId: string, productId: string, shopId: string): string {
  return `${userId}:${productId}:${shopId}`;
}

/**
 * Maps a MongoDB document to NotificationState domain model.
 */
export function toNotificationState(doc: INotificationStateDoc): NotificationState {
  return {
    userId: doc.userId,
    productId: doc.productId,
    shopId: doc.shopId,
    lastNotified: doc.lastNotified,
    lastPrice: doc.lastPrice,
    wasAvailable: doc.wasAvailable,
  };
}

/**
 * Maps an array of MongoDB documents to NotificationState domain models.
 */
export function toNotificationStateArray(docs: INotificationStateDoc[]): NotificationState[] {
  return docs.map(toNotificationState);
}

/**
 * Maps a NotificationState domain model to MongoDB document fields.
 */
export function toNotificationStateDoc(
  state: NotificationState,
): Omit<INotificationStateDoc, 'updatedAt'> {
  return {
    key: getStateKey(state.userId, state.productId, state.shopId),
    userId: state.userId,
    productId: state.productId,
    shopId: state.shopId,
    lastNotified: state.lastNotified,
    lastPrice: state.lastPrice,
    wasAvailable: state.wasAvailable,
  };
}
