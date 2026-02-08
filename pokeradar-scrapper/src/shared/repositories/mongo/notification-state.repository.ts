/**
 * MongoDB implementation of notification state repository.
 */

import { NotificationState } from '../../types';
import { INotificationStateRepository } from '../interfaces';
import { NotificationStateModel } from '../../../infrastructure/database/models';
import { toNotificationState, getStateKey } from './mappers';

export class MongoNotificationStateRepository implements INotificationStateRepository {
  async get(userId: string, productId: string, shopId: string): Promise<NotificationState | null> {
    const key = getStateKey(userId, productId, shopId);
    const doc = await NotificationStateModel.findOne({ key }).lean();
    if (!doc) return null;
    return toNotificationState(doc as any);
  }

  async set(state: NotificationState): Promise<void> {
    const key = getStateKey(state.userId, state.productId, state.shopId);
    await NotificationStateModel.updateOne(
      { key },
      {
        key,
        userId: state.userId,
        productId: state.productId,
        shopId: state.shopId,
        lastNotified: state.lastNotified,
        lastPrice: state.lastPrice,
        wasAvailable: state.wasAvailable,
      },
      { upsert: true }
    );
  }

  async setBatch(states: NotificationState[]): Promise<void> {
    if (states.length === 0) return;

    const operations = states.map((state) => {
      const key = getStateKey(state.userId, state.productId, state.shopId);
      return {
        updateOne: {
          filter: { key },
          update: {
            $set: {
              key,
              userId: state.userId,
              productId: state.productId,
              shopId: state.shopId,
              lastNotified: state.lastNotified,
              lastPrice: state.lastPrice,
              wasAvailable: state.wasAvailable,
            },
          },
          upsert: true,
        },
      };
    });

    await NotificationStateModel.bulkWrite(operations, { ordered: false });
  }

  async delete(userId: string, productId: string, shopId: string): Promise<void> {
    const key = getStateKey(userId, productId, shopId);
    await NotificationStateModel.deleteOne({ key });
  }

  async deleteBatch(keys: Array<{ userId: string; productId: string; shopId: string }>): Promise<void> {
    if (keys.length === 0) return;

    const operations = keys.map(({ userId, productId, shopId }) => ({
      deleteOne: {
        filter: { key: getStateKey(userId, productId, shopId) },
      },
    }));

    await NotificationStateModel.bulkWrite(operations, { ordered: false });
  }

  async getAll(productIds?: string[]): Promise<NotificationState[]> {
    const filter = productIds ? { productId: { $in: productIds } } : {};
    const docs = await NotificationStateModel.find(filter).lean();
    return docs.map((doc) => toNotificationState(doc as any));
  }
}
