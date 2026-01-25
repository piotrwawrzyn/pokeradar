import { WatchlistProductInternal } from '../../types';
import { IWatchlistRepository } from '../interfaces';
import { WatchlistProductModel } from './models';

/**
 * MongoDB implementation of watchlist repository.
 */
export class MongoWatchlistRepository implements IWatchlistRepository {
  async getAll(): Promise<WatchlistProductInternal[]> {
    const docs = await WatchlistProductModel.find().lean();
    return docs.map(doc => ({
      id: doc.id,
      name: doc.name,
      search: {
        phrases: doc.search.phrases,
        exclude: doc.search.exclude
      },
      price: {
        max: doc.price.max,
        min: doc.price.min
      }
    }));
  }

  async getById(id: string): Promise<WatchlistProductInternal | null> {
    const doc = await WatchlistProductModel.findOne({ id }).lean();
    if (!doc) return null;

    return {
      id: doc.id,
      name: doc.name,
      search: {
        phrases: doc.search.phrases,
        exclude: doc.search.exclude
      },
      price: {
        max: doc.price.max,
        min: doc.price.min
      }
    };
  }

  async add(product: WatchlistProductInternal): Promise<void> {
    await WatchlistProductModel.create({
      id: product.id,
      name: product.name,
      search: product.search,
      price: product.price
    });
  }

  async update(product: WatchlistProductInternal): Promise<void> {
    await WatchlistProductModel.updateOne(
      { id: product.id },
      {
        name: product.name,
        search: product.search,
        price: product.price
      }
    );
  }

  async delete(id: string): Promise<void> {
    await WatchlistProductModel.deleteOne({ id });
  }
}
