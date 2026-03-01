/**
 * MongoDB implementation of watchlist repository.
 */

import { WatchlistProductInternal } from '../../types';
import { IWatchlistRepository } from '../interfaces';
import { WatchlistProductModel } from '@pokeradar/shared';
import { toWatchlistProduct } from './mappers';
import { IWatchlistProductDoc } from '@pokeradar/shared';

export class MongoWatchlistRepository implements IWatchlistRepository {
  async getAll(): Promise<WatchlistProductInternal[]> {
    const docs = await WatchlistProductModel.find({ disabled: { $ne: true } }).lean();
    return docs.map((doc) => toWatchlistProduct(doc as IWatchlistProductDoc));
  }

  async getById(id: string): Promise<WatchlistProductInternal | null> {
    const doc = await WatchlistProductModel.findOne({ id }).lean();
    if (!doc) return null;
    return toWatchlistProduct(doc as IWatchlistProductDoc);
  }

  async add(product: WatchlistProductInternal): Promise<void> {
    await WatchlistProductModel.create({
      id: product.id,
      name: product.name,
      productSetId: product.productSetId,
      productTypeId: product.productTypeId,
      disabled: product.disabled,
    });
  }

  async update(product: WatchlistProductInternal): Promise<void> {
    await WatchlistProductModel.updateOne(
      { id: product.id },
      {
        name: product.name,
        productSetId: product.productSetId,
        productTypeId: product.productTypeId,
        disabled: product.disabled,
      },
    );
  }

  async delete(id: string): Promise<void> {
    await WatchlistProductModel.deleteOne({ id });
  }
}
