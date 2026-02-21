/**
 * MongoDB repository for User (read-only).
 */

import { UserModel } from '../../../infrastructure/database/models';

/**
 * Notification target for a user: true when at least one channel is configured.
 */
export interface UserNotificationTarget {
  userId: string;
  hasAnyChannel: boolean;
}

export class MongoUserRepository {
  /**
   * Batch fetches users by ID array, returns only those with at least one linked channel.
   * Returns a map of userId → UserNotificationTarget.
   */
  async getNotificationTargets(userIds: string[]): Promise<Map<string, UserNotificationTarget>> {
    if (userIds.length === 0) return new Map();

    const docs = await UserModel.find({
      _id: { $in: userIds },
      $or: [{ 'telegram.channelId': { $ne: null } }, { 'discord.channelId': { $ne: null } }],
    })
      .select('_id')
      .lean();

    const map = new Map<string, UserNotificationTarget>();
    for (const doc of docs) {
      const userId = doc._id.toString();
      map.set(userId, { userId, hasAnyChannel: true });
    }
    return map;
  }
}
