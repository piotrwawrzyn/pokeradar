/**
 * WatchlistProduct MongoDB model (unified across API and scrapper).
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ISearchOverride {
  additionalRequired?: string[];
  additionalForbidden?: string[];
  customPhrase?: string;
}

export interface IWatchlistProductDoc extends Document {
  id: string;
  name: string;
  imageUrl: string;
  productSetId?: string;
  productTypeId?: string;
  searchOverride?: ISearchOverride;
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
  productSetId: { type: String },
  productTypeId: { type: String },
  searchOverride: {
    type: {
      additionalRequired: { type: [String] },
      additionalForbidden: { type: [String] },
      customPhrase: { type: String },
    },
    required: false,
  },
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
