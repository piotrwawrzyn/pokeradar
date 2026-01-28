/**
 * WatchlistProduct MongoDB model.
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * WatchlistProduct document interface.
 */
export interface IWatchlistProductDoc extends Document {
  id: string;
  name: string;
  search: {
    phrases: string[];
    exclude?: string[];
  };
  price: {
    max: number;
    min?: number;
  };
}

/**
 * WatchlistProduct schema definition.
 */
const WatchlistProductSchema = new Schema<IWatchlistProductDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  search: {
    phrases: { type: [String], required: true },
    exclude: { type: [String], default: [] },
  },
  price: {
    max: { type: Number, required: true },
    min: { type: Number },
  },
});

export const WatchlistProductModel = mongoose.model<IWatchlistProductDoc>(
  'WatchlistProduct',
  WatchlistProductSchema
);
