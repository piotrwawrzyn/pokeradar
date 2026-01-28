/**
 * MongoDB implementation of notification state repository.
 */

import { NotificationState } from '../../types';
import { INotificationStateRepository } from '../interfaces';
import { NotificationStateModel } from '../../../infrastructure/database/models';
import { toNotificationState, getStateKey } from './mappers';

export class MongoNotificationStateRepository implements INotificationStateRepository {
  async get(productId: string, shopId: string): Promise<NotificationState | null> {
    const key = getStateKey(productId, shopId);
    const doc = await NotificationStateModel.findOne({ key }).lean();
    if (!doc) return null;
    return toNotificationState(doc as any);
  }

  async set(state: NotificationState): Promise<void> {
    const key = getStateKey(state.productId, state.shopId);
    await NotificationStateModel.updateOne(
      { key },
      {
        key,
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
      const key = getStateKey(state.productId, state.shopId);
      return {
        updateOne: {
          filter: { key },
          update: {
            $set: {
              key,
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

  async delete(productId: string, shopId: string): Promise<void> {
    const key = getStateKey(productId, shopId);
    await NotificationStateModel.deleteOne({ key });
  }

  async deleteBatch(keys: Array<{ productId: string; shopId: string }>): Promise<void> {
    if (keys.length === 0) return;

    const operations = keys.map(({ productId, shopId }) => ({
      deleteOne: {
        filter: { key: getStateKey(productId, shopId) },
      },
    }));

    await NotificationStateModel.bulkWrite(operations, { ordered: false });
  }

  async getAll(): Promise<NotificationState[]> {
    const docs = await NotificationStateModel.find().lean();
    return docs.map((doc) => toNotificationState(doc as any));
  }
}
