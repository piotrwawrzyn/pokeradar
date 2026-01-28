/**
 * ProductResult MongoDB model.
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * ProductResult document interface.
 */
export interface IProductResultDoc extends Document {
  productId: string;
  shopId: string;
  hourBucket: string; // Format: "YYYY-MM-DDTHH" for hourly aggregation
  productUrl: string;
  price: number | null;
  isAvailable: boolean;
  timestamp: Date;
  createdAt: Date;
}

/**
 * ProductResult schema definition.
 */
const ProductResultSchema = new Schema<IProductResultDoc>(
  {
    productId: { type: String, required: true },
    shopId: { type: String, required: true },
    hourBucket: { type: String, required: true }, // "YYYY-MM-DDTHH" for hourly deduplication
    productUrl: { type: String, default: '' },
    price: { type: Number, default: null },
    isAvailable: { type: Boolean, required: true },
    timestamp: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Unique compound index for hourly upserts - ensures 1 record per product/shop/hour
ProductResultSchema.index(
  { productId: 1, shopId: 1, hourBucket: 1 },
  { unique: true }
);

// TTL index - expires after 24 hours (keep 1 day of hourly history)
ProductResultSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

// Query index for efficient lookups
ProductResultSchema.index({ productId: 1, timestamp: -1 });

export const ProductResultModel = mongoose.model<IProductResultDoc>(
  'ProductResult',
  ProductResultSchema
);
