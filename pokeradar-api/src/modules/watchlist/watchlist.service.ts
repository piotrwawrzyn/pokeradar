import { Types } from 'mongoose';
import {
  UserWatchEntryModel,
  WatchlistProductModel,
  NotificationModel,
  NotificationStateModel,
} from '../../infrastructure/database/models';
import { NotFoundError } from '../../shared/middleware';
import { WatchlistEntryResponse } from '../../shared/types';

export class WatchlistService {
  async getUserWatchlist(userId: string): Promise<WatchlistEntryResponse[]> {
    const entries = await UserWatchEntryModel.find({
      userId: new Types.ObjectId(userId),
    }).lean();

    return entries.map((entry) => ({
      id: entry._id.toString(),
      productId: entry.productId,
      maxPrice: entry.maxPrice,
      createdAt: entry.createdAt,
    }));
  }

  async addEntry(userId: string, productId: string, maxPrice: number) {
    const product = await WatchlistProductModel.findOne({ id: productId }).lean();
    if (!product) throw new NotFoundError('Product not found in catalog');

    const entry = await UserWatchEntryModel.create({
      userId: new Types.ObjectId(userId),
      productId,
      maxPrice,
    });

    return {
      id: entry._id.toString(),
      productId: entry.productId,
      maxPrice: entry.maxPrice,
      createdAt: entry.createdAt,
    };
  }

  async updateEntry(userId: string, entryId: string, updates: { maxPrice?: number }) {
    const entry = await UserWatchEntryModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(entryId),
        userId: new Types.ObjectId(userId),
      },
      { $set: updates },
      { new: true },
    );

    if (!entry) throw new NotFoundError('Watch entry not found');

    return {
      id: entry._id.toString(),
      productId: entry.productId,
      maxPrice: entry.maxPrice,
      createdAt: entry.createdAt,
    };
  }

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    const entry = await UserWatchEntryModel.findOneAndDelete({
      _id: new Types.ObjectId(entryId),
      userId: new Types.ObjectId(userId),
    });

    if (!entry) {
      throw new NotFoundError('Watch entry not found');
    }

    // Cascade delete: remove all notifications and notification states for this user+product
    await Promise.all([
      NotificationStateModel.deleteMany({ userId, productId: entry.productId }),
      NotificationModel.deleteMany({
        userId,
        'payload.productId': entry.productId,
        status: 'pending',
      }),
    ]);
  }
}
