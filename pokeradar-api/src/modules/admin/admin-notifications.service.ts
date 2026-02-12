import {
  NotificationModel,
  UserModel,
} from '../../infrastructure/database/models';

export interface AdminNotificationItem {
  id: string;
  userId: string;
  userEmail: string;
  channel: string;
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
  attempts: number;
  error: string | null;
  sentAt: Date | null;
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
    const users = await UserModel.find({ _id: { $in: userIds } })
      .select('_id email')
      .lean();
    const emailMap = new Map(users.map((u) => [u._id.toString(), u.email]));

    return {
      data: notifications.map((n) => ({
        id: n._id.toString(),
        userId: n.userId,
        userEmail: emailMap.get(n.userId) ?? 'unknown',
        channel: n.channel,
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
        attempts: n.attempts,
        error: n.error,
        sentAt: n.sentAt,
        createdAt: n.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
