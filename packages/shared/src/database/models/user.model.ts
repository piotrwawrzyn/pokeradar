import mongoose, { Schema, Document } from 'mongoose';

export interface IUserDoc extends Document {
  googleId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  lastLogin: Date | null;
  telegramChatId: string | null;
  telegramLinkToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    lastLogin: { type: Date, default: null },
    telegramChatId: { type: String, default: null },
    telegramLinkToken: { type: String, default: null },
  },
  { timestamps: true }
);

UserSchema.index({ telegramLinkToken: 1 }, { sparse: true });
UserSchema.index({ telegramChatId: 1 }, { sparse: true });

export const UserModel = mongoose.model<IUserDoc>('User', UserSchema);
