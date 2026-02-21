import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationPayload {
  productName: string;
  shopName: string;
  shopId: string;
  productId: string;
  price: number;
  maxPrice: number;
  productUrl: string;
}

export type NotificationChannel = 'telegram' | 'discord';

export interface IDelivery {
  channel: NotificationChannel;
  channelTarget: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  error: string | null;
  sentAt: Date | null;
}

export interface INotificationDoc extends Document {
  userId: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  payload: INotificationPayload;
  deliveries: IDelivery[];
  createdAt: Date;
}

const NotificationPayloadSchema = new Schema<INotificationPayload>(
  {
    productName: { type: String, required: true },
    shopName: { type: String, required: true },
    shopId: { type: String, required: true },
    productId: { type: String, required: true },
    price: { type: Number, required: true },
    maxPrice: { type: Number, required: true },
    productUrl: { type: String, required: true },
  },
  { _id: false },
);

const DeliverySchema = new Schema<IDelivery>(
  {
    channel: { type: String, required: true, enum: ['telegram', 'discord'] },
    channelTarget: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    attempts: { type: Number, required: true, default: 0 },
    error: { type: String, default: null },
    sentAt: { type: Date, default: null },
  },
  { _id: false },
);

const NotificationSchema = new Schema<INotificationDoc>(
  {
    userId: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'sending', 'sent', 'failed'],
      default: 'pending',
    },
    payload: { type: NotificationPayloadSchema, required: true },
    deliveries: { type: [DeliverySchema], default: [] },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

NotificationSchema.index({ status: 1, createdAt: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const NotificationModel = mongoose.model<INotificationDoc>(
  'Notification',
  NotificationSchema,
);
