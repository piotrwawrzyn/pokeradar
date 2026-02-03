/**
 * MongoDB repository for creating notification documents.
 * Used by the scrapper to insert pending notifications for the notifications service.
 */

import { NotificationModel, type INotificationPayload } from '../../../infrastructure/database/models';

export interface NotificationInsert {
  userId: string;
  channel: 'telegram';
  channelTarget: string;
  payload: INotificationPayload;
}

export class MongoNotificationRepository {
  async insertBatch(notifications: NotificationInsert[]): Promise<void> {
    if (notifications.length === 0) return;

    const docs = notifications.map((n) => ({
      userId: n.userId,
      channel: n.channel,
      channelTarget: n.channelTarget,
      status: 'pending' as const,
      payload: n.payload,
      attempts: 0,
      error: null,
      sentAt: null,
    }));

    await NotificationModel.insertMany(docs, { ordered: false });
  }
}
