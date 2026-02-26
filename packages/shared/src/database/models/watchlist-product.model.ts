/**
 * WatchlistProduct MongoDB model (unified across API and scrapper).
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IWatchlistProductDoc extends Document {
  id: string;
  name: string;
  imageUrl: string;
  productSetId: string;
  productTypeId: string;
  price?: {
    max: number;
    min?: number;
  };
  disabled?: boolean;
}

const WatchlistProductSchema = new Schema<IWatchlistProductDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  imageUrl: { type: String, required: true },
  productSetId: { type: String, required: true },
  productTypeId: { type: String, required: true },
  price: {
    type: {
      max: { type: Number, required: true },
      min: { type: Number },
    },
    required: false,
  },
  disabled: { type: Boolean },
});

export const WatchlistProductModel = mongoose.model<IWatchlistProductDoc>(
  'WatchlistProduct',
  WatchlistProductSchema,
);
