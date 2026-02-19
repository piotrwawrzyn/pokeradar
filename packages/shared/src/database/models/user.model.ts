import mongoose, { Schema, Document } from 'mongoose';

export interface IUserDoc extends Document {
  clerkId: string;
  telegramChatId: string | null;
  telegramLinkToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
  {
    clerkId: { type: String, required: true, unique: true },
    telegramChatId: { type: String, default: null },
    telegramLinkToken: { type: String, default: null },
  },
  { timestamps: true }
);

UserSchema.index({ telegramLinkToken: 1 }, { sparse: true });
UserSchema.index({ telegramChatId: 1 }, { sparse: true });

export const UserModel = mongoose.model<IUserDoc>('User', UserSchema);
