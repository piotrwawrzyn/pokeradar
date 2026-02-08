import mongoose, { Schema, Document } from 'mongoose';

export interface IProductResultDoc extends Document {
  productId: string;
  shopId: string;
  hourBucket: string;
  productUrl: string;
  price: number | null;
  isAvailable: boolean;
  timestamp: Date;
  createdAt: Date;
}

const ProductResultSchema = new Schema<IProductResultDoc>(
  {
    productId: { type: String, required: true },
    shopId: { type: String, required: true },
    hourBucket: { type: String, required: true },
    productUrl: { type: String, default: '' },
    price: { type: Number, default: null },
    isAvailable: { type: Boolean, required: true },
    timestamp: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

ProductResultSchema.index(
  { productId: 1, shopId: 1, hourBucket: 1 },
  { unique: true }
);
ProductResultSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });
ProductResultSchema.index({ productId: 1, timestamp: -1 });

export const ProductResultModel = mongoose.model<IProductResultDoc>(
  'ProductResult',
  ProductResultSchema
);
