/**
 * Mapper for NotificationState document to domain model conversion.
 */

import { NotificationState } from '../../../types';

/**
 * NotificationState document interface (from MongoDB).
 */
export interface INotificationStateDoc {
  key: string; // {productId}:{shopId}
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
export function getStateKey(productId: string, shopId: string): string {
  return `${productId}:${shopId}`;
}

/**
 * Maps a MongoDB document to NotificationState domain model.
 */
export function toNotificationState(doc: INotificationStateDoc): NotificationState {
  return {
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
export function toNotificationStateDoc(state: NotificationState): Omit<INotificationStateDoc, 'updatedAt'> {
  return {
    key: getStateKey(state.productId, state.shopId),
    productId: state.productId,
    shopId: state.shopId,
    lastNotified: state.lastNotified,
    lastPrice: state.lastPrice,
    wasAvailable: state.wasAvailable,
  };
}
