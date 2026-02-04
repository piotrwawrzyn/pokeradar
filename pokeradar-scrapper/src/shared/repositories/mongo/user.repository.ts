/**
 * MongoDB repository for User (read-only).
 */

import { UserModel } from '../../../infrastructure/database/models';

/**
 * Notification target for a user with linked Telegram.
 */
export interface UserNotificationTarget {
  userId: string;
  telegramChatId: string;
  displayName: string;
}

export class MongoUserRepository {
  /**
   * Batch fetches users by ID array, returns only those with non-null telegramChatId.
   * Returns a map of userId → UserNotificationTarget.
   */
  async getNotificationTargets(userIds: string[]): Promise<Map<string, UserNotificationTarget>> {
    if (userIds.length === 0) return new Map();

    const docs = await UserModel.find({
      _id: { $in: userIds },
      telegramChatId: { $ne: null },
    }).lean();

    const map = new Map<string, UserNotificationTarget>();
    for (const doc of docs) {
      const userId = doc._id.toString();
      map.set(userId, {
        userId,
        telegramChatId: doc.telegramChatId!,
        displayName: doc.displayName,
      });
    }
    return map;
  }
}
