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
  productUrl: string;
  price: number | null;
  isAvailable: boolean;
  timestamp: Date;
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

// ProductResult Schema with TTL (auto-expire after 7 days)
const ProductResultSchema = new Schema<IProductResultDoc>({
  productId: { type: String, required: true },
  shopId: { type: String, required: true },
  productUrl: { type: String, default: '' },
  price: { type: Number, default: null },
  isAvailable: { type: Boolean, required: true },
  timestamp: { type: Date, required: true }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Create TTL index for ProductResult - expires after 1 hour
ProductResultSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 });

// Create compound index for efficient queries
ProductResultSchema.index({ productId: 1, shopId: 1, timestamp: -1 });
NotificationStateSchema.index({ productId: 1, shopId: 1 });

export const WatchlistProductModel = mongoose.model<IWatchlistProductDoc>('WatchlistProduct', WatchlistProductSchema);
export const NotificationStateModel = mongoose.model<INotificationStateDoc>('NotificationState', NotificationStateSchema);
export const ProductResultModel = mongoose.model<IProductResultDoc>('ProductResult', ProductResultSchema);
