import { NotificationState } from '../../types';
import { INotificationStateRepository } from '../interfaces';
import { NotificationStateModel } from './models';

/**
 * MongoDB implementation of notification state repository.
 */
export class MongoNotificationStateRepository implements INotificationStateRepository {
  private getKey(productId: string, shopId: string): string {
    return `${productId}:${shopId}`;
  }

  async get(productId: string, shopId: string): Promise<NotificationState | null> {
    const key = this.getKey(productId, shopId);
    const doc = await NotificationStateModel.findOne({ key }).lean();

    if (!doc) return null;

    return {
      productId: doc.productId,
      shopId: doc.shopId,
      lastNotified: doc.lastNotified,
      lastPrice: doc.lastPrice,
      wasAvailable: doc.wasAvailable
    };
  }

  async set(state: NotificationState): Promise<void> {
    const key = this.getKey(state.productId, state.shopId);

    await NotificationStateModel.updateOne(
      { key },
      {
        key,
        productId: state.productId,
        shopId: state.shopId,
        lastNotified: state.lastNotified,
        lastPrice: state.lastPrice,
        wasAvailable: state.wasAvailable
      },
      { upsert: true }
    );
  }

  async delete(productId: string, shopId: string): Promise<void> {
    const key = this.getKey(productId, shopId);
    await NotificationStateModel.deleteOne({ key });
  }

  async getAll(): Promise<NotificationState[]> {
    const docs = await NotificationStateModel.find().lean();
    return docs.map(doc => ({
      productId: doc.productId,
      shopId: doc.shopId,
      lastNotified: doc.lastNotified,
      lastPrice: doc.lastPrice,
      wasAvailable: doc.wasAvailable
    }));
  }
}
