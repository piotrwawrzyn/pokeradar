import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserWatchEntryDoc extends Document {
  userId: Types.ObjectId;
  productId: string;
  maxPrice: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserWatchEntrySchema = new Schema<IUserWatchEntryDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: String, required: true },
    maxPrice: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

UserWatchEntrySchema.index({ userId: 1, productId: 1 }, { unique: true });
UserWatchEntrySchema.index({ productId: 1, isActive: 1 });
UserWatchEntrySchema.index({ userId: 1, isActive: 1 });

export const UserWatchEntryModel = mongoose.model<IUserWatchEntryDoc>(
  'UserWatchEntry',
  UserWatchEntrySchema
);
