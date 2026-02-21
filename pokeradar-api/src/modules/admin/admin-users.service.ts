import { clerkClient } from '@clerk/express';
import {
  UserModel,
  UserWatchEntryModel,
  NotificationModel,
  WatchlistProductModel,
} from '../../infrastructure/database/models';
import { NotFoundError } from '../../shared/middleware';

export interface AdminUserSearchItem {
  clerkId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  telegramLinked: boolean;
  discordLinked: boolean;
}

export interface AdminUserDetail {
  clerkId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  telegramLinked: boolean;
  telegramChannelId: string | null;
  discordLinked: boolean;
  discordChannelId: string | null;
  lastLogin: Date | null;
  createdAt: Date;
  watchlistCount: number;
  watchlistEntries: Array<{
    productId: string;
    productName: string;
    maxPrice: number;
    isActive: boolean;
  }>;
  notifications: Array<{
    id: string;
    status: string;
    payload: {
      productName: string;
      shopName: string;
      price: number;
      maxPrice: number;
      productUrl: string;
    };
    createdAt: Date;
  }>;
}

export class AdminUsersService {
  async searchUsers(query: string): Promise<AdminUserSearchItem[]> {
    if (!query.trim()) return [];

    const { data: clerkUsers } = await clerkClient.users.getUserList({
      query,
      limit: 20,
    });

    const clerkIds = clerkUsers.map((u) => u.id);
    const dbUsers = await UserModel.find({ clerkId: { $in: clerkIds } }).lean();
    const dbMap = new Map(dbUsers.map((u) => [u.clerkId, u]));

    return clerkUsers.map((cu) => {
      const dbUser = dbMap.get(cu.id);
      return {
        clerkId: cu.id,
        email: cu.emailAddresses[0]?.emailAddress ?? '',
        displayName: cu.fullName ?? '',
        isAdmin: (cu.publicMetadata as any)?.isAdmin === true,
        telegramLinked: (dbUser?.telegram?.channelId ?? null) !== null,
        discordLinked: (dbUser?.discord?.channelId ?? null) !== null,
      };
    });
  }

  async getUserDetail(clerkId: string): Promise<AdminUserDetail> {
    const [clerkUser, dbUser] = await Promise.all([
      clerkClient.users.getUser(clerkId),
      UserModel.findOne({ clerkId }).lean(),
    ]);

    if (!clerkUser) throw new NotFoundError('User not found');

    const mongoId = dbUser?._id;

    const [watchEntries, notifications, watchlistCount] = await Promise.all([
      mongoId ? UserWatchEntryModel.find({ userId: mongoId }).lean() : [],
      mongoId
        ? NotificationModel.find({ userId: mongoId.toString() })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean()
        : [],
      mongoId ? UserWatchEntryModel.countDocuments({ userId: mongoId }) : 0,
    ]);

    const productIds = (watchEntries as any[]).map((e) => e.productId);
    const products = productIds.length
      ? await WatchlistProductModel.find({ id: { $in: productIds } })
          .select('id name')
          .lean()
      : [];
    const productNameMap = new Map(products.map((p) => [p.id, p.name]));

    return {
      clerkId,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? '',
      displayName: clerkUser.fullName ?? '',
      isAdmin: (clerkUser.publicMetadata as any)?.isAdmin === true,
      telegramLinked: (dbUser?.telegram?.channelId ?? null) !== null,
      telegramChannelId: dbUser?.telegram?.channelId ?? null,
      discordLinked: (dbUser?.discord?.channelId ?? null) !== null,
      discordChannelId: dbUser?.discord?.channelId ?? null,
      lastLogin: clerkUser.lastSignInAt ? new Date(clerkUser.lastSignInAt) : null,
      createdAt: new Date(clerkUser.createdAt),
      watchlistCount,
      watchlistEntries: (watchEntries as any[]).map((e) => ({
        productId: e.productId,
        productName: productNameMap.get(e.productId) ?? e.productId,
        maxPrice: e.maxPrice,
        isActive: e.isActive,
      })),
      notifications: (notifications as any[]).map((n) => ({
        id: n._id.toString(),
        status: n.status,
        payload: {
          productName: n.payload.productName,
          shopName: n.payload.shopName,
          price: n.payload.price,
          maxPrice: n.payload.maxPrice,
          productUrl: n.payload.productUrl,
        },
        createdAt: n.createdAt,
      })),
    };
  }
}
