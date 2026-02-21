/**
 * MongoDB repository for creating notification documents.
 * Used by the scrapper to insert pending, channel-agnostic notifications.
 * The notifications service resolves which channels to deliver to at delivery time.
 */

import {
  NotificationModel,
  type INotificationPayload,
} from '../../../infrastructure/database/models';

export interface NotificationInsert {
  userId: string;
  payload: INotificationPayload;
}

export class MongoNotificationRepository {
  async insertBatch(notifications: NotificationInsert[]): Promise<void> {
    if (notifications.length === 0) return;

    const docs = notifications.map((n) => ({
      userId: n.userId,
      status: 'pending' as const,
      payload: n.payload,
      deliveries: [],
    }));

    await NotificationModel.insertMany(docs, { ordered: false });
  }
}
