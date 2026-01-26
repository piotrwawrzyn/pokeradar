import mongoose, { Schema, Document } from 'mongoose';

/**
 * WatchlistProduct document interface
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
 * NotificationState document interface
 */
export interface INotificationStateDoc extends Document {
  key: string; // {productId}:{shopId}
  productId: string;
  shopId: string;
  lastNotified: Date | null;
  lastPrice: number | null;
  wasAvailable: boolean;
  updatedAt: Date;
}

/**
 * ProductResult document interface
 */
export interface IProductResultDoc extends Document {
  productId: string;
  shopId: string;
  hourBucket: string; // Format: "YYYY-MM-DDTHH" for hourly aggregation
  productUrl: string;
  price: number | null;
  isAvailable: boolean;
  timestamp: Date;
  scanCount: number; // Track how many scans occurred in this hour
  createdAt: Date;
}

// WatchlistProduct Schema
const WatchlistProductSchema = new Schema<IWatchlistProductDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  search: {
    phrases: { type: [String], required: true },
    exclude: { type: [String], default: [] }
  },
  price: {
    max: { type: Number, required: true },
    min: { type: Number }
  }
});

// NotificationState Schema
const NotificationStateSchema = new Schema<INotificationStateDoc>({
  key: { type: String, required: true, unique: true },
  productId: { type: String, required: true },
  shopId: { type: String, required: true },
  lastNotified: { type: Date, default: null },
  lastPrice: { type: Number, default: null },
  wasAvailable: { type: Boolean, required: true }
}, {
  timestamps: { createdAt: false, updatedAt: true }
});

// ProductResult Schema with TTL and hourly aggregation
const ProductResultSchema = new Schema<IProductResultDoc>({
  productId: { type: String, required: true },
  shopId: { type: String, required: true },
  hourBucket: { type: String, required: true }, // "YYYY-MM-DDTHH" for hourly deduplication
  productUrl: { type: String, default: '' },
  price: { type: Number, default: null },
  isAvailable: { type: Boolean, required: true },
  timestamp: { type: Date, required: true },
  scanCount: { type: Number, default: 1 }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Unique compound index for hourly upserts - ensures 1 record per product/shop/hour
ProductResultSchema.index(
  { productId: 1, shopId: 1, hourBucket: 1 },
  { unique: true }
);

// TTL index - expires after 24 hours (keep 1 day of hourly history)
ProductResultSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

// Query index for efficient lookups
ProductResultSchema.index({ productId: 1, timestamp: -1 });
NotificationStateSchema.index({ productId: 1, shopId: 1 });

export const WatchlistProductModel = mongoose.model<IWatchlistProductDoc>('WatchlistProduct', WatchlistProductSchema);
export const NotificationStateModel = mongoose.model<INotificationStateDoc>('NotificationState', NotificationStateSchema);
export const ProductResultModel = mongoose.model<IProductResultDoc>('ProductResult', ProductResultSchema);
