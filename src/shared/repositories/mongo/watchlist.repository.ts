/**
 * MongoDB implementation of watchlist repository.
 */

import { WatchlistProductInternal } from '../../types';
import { IWatchlistRepository } from '../interfaces';
import { WatchlistProductModel } from '../../../infrastructure/database/models';
import { toWatchlistProduct } from './mappers';

export class MongoWatchlistRepository implements IWatchlistRepository {
  async getAll(): Promise<WatchlistProductInternal[]> {
    const docs = await WatchlistProductModel.find().lean();
    return docs.map((doc) => toWatchlistProduct(doc as any));
  }

  async getById(id: string): Promise<WatchlistProductInternal | null> {
    const doc = await WatchlistProductModel.findOne({ id }).lean();
    if (!doc) return null;
    return toWatchlistProduct(doc as any);
  }

  async add(product: WatchlistProductInternal): Promise<void> {
    await WatchlistProductModel.create({
      id: product.id,
      name: product.name,
      search: product.search,
      price: product.price,
    });
  }

  async update(product: WatchlistProductInternal): Promise<void> {
    await WatchlistProductModel.updateOne(
      { id: product.id },
      {
        name: product.name,
        search: product.search,
        price: product.price,
      }
    );
  }

  async delete(id: string): Promise<void> {
    await WatchlistProductModel.deleteOne({ id });
  }
}
