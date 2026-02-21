import { clerkClient } from '@clerk/express';
import { NotificationModel, UserModel } from '../../infrastructure/database/models';

export interface AdminNotificationItem {
  id: string;
  userId: string;
  userEmail: string;
  status: string;
  payload: {
    productName: string;
    shopName: string;
    shopId: string;
    productId: string;
    price: number;
    maxPrice: number;
    productUrl: string;
  };
  deliveries: Array<{
    channel: string;
    status: string;
    attempts: number;
    error: string | null;
    sentAt: Date | null;
  }>;
  createdAt: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class AdminNotificationsService {
  async listNotifications(params: {
    page: number;
    limit: number;
    status?: string;
    userId?: string;
  }): Promise<PaginatedResponse<AdminNotificationItem>> {
    const { page, limit, status, userId } = params;
    const filter: Record<string, unknown> = {};

    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    const [notifications, total] = await Promise.all([
      NotificationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      NotificationModel.countDocuments(filter),
    ]);

    const userIds = [...new Set(notifications.map((n) => n.userId))];
    // Fetch clerkIds from MongoDB, then batch-fetch emails from Clerk
    const dbUsers = await UserModel.find({ _id: { $in: userIds } })
      .select('_id clerkId')
      .lean();
    const mongoIdToClerkId = new Map(dbUsers.map((u) => [u._id.toString(), u.clerkId]));
    const clerkIds = dbUsers.map((u) => u.clerkId).filter(Boolean);
    const { data: clerkUsers } =
      clerkIds.length > 0
        ? await clerkClient.users.getUserList({ userId: clerkIds, limit: clerkIds.length })
        : { data: [] };
    const clerkEmailMap = new Map(
      clerkUsers.map((u) => [u.id, u.emailAddresses[0]?.emailAddress ?? 'unknown']),
    );
    const emailMap = new Map(
      dbUsers.map((u) => [u._id.toString(), clerkEmailMap.get(u.clerkId) ?? 'unknown']),
    );

    return {
      data: notifications.map((n) => ({
        id: n._id.toString(),
        userId: n.userId,
        userEmail: emailMap.get(n.userId) ?? 'unknown',
        status: n.status,
        payload: {
          productName: n.payload.productName,
          shopName: n.payload.shopName,
          shopId: n.payload.shopId,
          productId: n.payload.productId,
          price: n.payload.price,
          maxPrice: n.payload.maxPrice,
          productUrl: n.payload.productUrl,
        },
        deliveries: (n.deliveries ?? []).map((d) => ({
          channel: d.channel,
          status: d.status,
          attempts: d.attempts,
          error: d.error ?? null,
          sentAt: d.sentAt ?? null,
        })),
        createdAt: n.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
