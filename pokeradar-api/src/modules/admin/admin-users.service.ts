import {
  UserModel,
  UserWatchEntryModel,
  NotificationModel,
  WatchlistProductModel,
} from '../../infrastructure/database/models';
import { NotFoundError } from '../../shared/middleware';

export interface AdminUserListItem {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  telegramLinked: boolean;
  lastLogin: Date | null;
  watchlistCount: number;
  createdAt: Date;
}

export interface AdminUserDetail extends AdminUserListItem {
  googleId: string;
  telegramChatId: string | null;
  watchlistEntries: Array<{
    productId: string;
    productName: string;
    maxPrice: number;
    isActive: boolean;
  }>;
  notifications: Array<{
    id: string;
    channel: string;
    status: string;
    payload: {
      productName: string;
      shopName: string;
      price: number;
      maxPrice: number;
      productUrl: string;
    };
    sentAt: Date | null;
    createdAt: Date;
    error: string | null;
  }>;
}

export class AdminUsersService {
  async listUsers(): Promise<AdminUserListItem[]> {
    const [users, watchlistCounts] = await Promise.all([
      UserModel.find().sort({ createdAt: -1 }).lean(),
      UserWatchEntryModel.aggregate([
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = new Map<string, number>(
      watchlistCounts.map((w: { _id: any; count: number }) => [
        w._id.toString(),
        w.count,
      ]),
    );

    return users.map((user) => ({
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      isAdmin: user.isAdmin,
      telegramLinked: user.telegramChatId !== null,
      lastLogin: user.lastLogin ?? null,
      watchlistCount: countMap.get(user._id.toString()) ?? 0,
      createdAt: user.createdAt,
    }));
  }

  async getUserDetail(userId: string): Promise<AdminUserDetail> {
    const user = await UserModel.findById(userId).lean();
    if (!user) throw new NotFoundError('User not found');

    const [watchEntries, notifications] = await Promise.all([
      UserWatchEntryModel.find({ userId: user._id }).lean(),
      NotificationModel.find({ userId: user._id.toString() })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const productIds = watchEntries.map((e) => e.productId);
    const products = await WatchlistProductModel.find({ id: { $in: productIds } })
      .select('id name')
      .lean();
    const productNameMap = new Map(products.map((p) => [p.id, p.name]));

    const watchlistCounts = await UserWatchEntryModel.countDocuments({
      userId: user._id,
    });

    return {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      isAdmin: user.isAdmin,
      telegramLinked: user.telegramChatId !== null,
      lastLogin: user.lastLogin ?? null,
      watchlistCount: watchlistCounts,
      createdAt: user.createdAt,
      googleId: user.googleId,
      telegramChatId: user.telegramChatId,
      watchlistEntries: watchEntries.map((e) => ({
        productId: e.productId,
        productName: productNameMap.get(e.productId) ?? e.productId,
        maxPrice: e.maxPrice,
        isActive: e.isActive,
      })),
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        channel: n.channel,
        status: n.status,
        payload: {
          productName: n.payload.productName,
          shopName: n.payload.shopName,
          price: n.payload.price,
          maxPrice: n.payload.maxPrice,
          productUrl: n.payload.productUrl,
        },
        sentAt: n.sentAt,
        createdAt: n.createdAt,
        error: n.error,
      })),
    };
  }
}
