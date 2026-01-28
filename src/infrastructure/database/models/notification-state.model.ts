/**
 * NotificationState MongoDB model.
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * NotificationState document interface.
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
 * NotificationState schema definition.
 */
const NotificationStateSchema = new Schema<INotificationStateDoc>(
  {
    key: { type: String, required: true, unique: true },
    productId: { type: String, required: true },
    shopId: { type: String, required: true },
    lastNotified: { type: Date, default: null },
    lastPrice: { type: Number, default: null },
    wasAvailable: { type: Boolean, required: true },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
  }
);

// Index for efficient lookups
NotificationStateSchema.index({ productId: 1, shopId: 1 });

export const NotificationStateModel = mongoose.model<INotificationStateDoc>(
  'NotificationState',
  NotificationStateSchema
);
