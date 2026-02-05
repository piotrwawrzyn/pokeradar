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
  productSetId?: string;
  search: {
    phrases: string[];
    exclude?: string[];
  };
  disabled?: boolean;
}

/**
 * WatchlistProduct schema definition.
 */
const WatchlistProductSchema = new Schema<IWatchlistProductDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  productSetId: { type: String },
  search: {
    phrases: { type: [String], required: true },
    exclude: { type: [String], default: [] },
  },
  disabled: { type: Boolean },
});

export const WatchlistProductModel = mongoose.model<IWatchlistProductDoc>(
  'WatchlistProduct',
  WatchlistProductSchema
);
