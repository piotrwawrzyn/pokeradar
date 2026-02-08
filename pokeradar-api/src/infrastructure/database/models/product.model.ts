/**
 * Read-only mirror of the scraper's WatchlistProduct model.
 * Must use model name 'WatchlistProduct' to map to existing 'watchlistproducts' collection.
 * Schema must be identical to the scraper's to avoid index conflicts.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IWatchlistProductDoc extends Document {
  id: string;
  name: string;
  imageUrl: string;
  productSetId?: string;
  search: {
    phrases: string[];
    exclude?: string[];
  };
  price: {
    max: number;
    min?: number;
  };
  disabled?: boolean;
}

const WatchlistProductSchema = new Schema<IWatchlistProductDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  imageUrl: { type: String, required: true },
  productSetId: { type: String },
  search: {
    phrases: { type: [String], required: true },
    exclude: { type: [String], default: [] },
  },
  price: {
    max: { type: Number, required: true },
    min: { type: Number },
  },
  disabled: { type: Boolean },
});

export const WatchlistProductModel = mongoose.model<IWatchlistProductDoc>(
  'WatchlistProduct',
  WatchlistProductSchema
);
