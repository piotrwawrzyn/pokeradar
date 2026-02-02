/**
 * User MongoDB model (read-only mirror of API's users collection).
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * User document interface.
 */
export interface IUserDoc extends Document {
  googleId: string;
  email: string;
  displayName: string;
  telegramChatId: string | null;
  telegramLinkToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User schema definition.
 * Must exactly match the API's user.model.ts to avoid index conflicts.
 */
const UserSchema = new Schema<IUserDoc>(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    telegramChatId: { type: String, default: null },
    telegramLinkToken: { type: String, default: null },
  },
  { timestamps: true }
);

UserSchema.index({ googleId: 1 });
UserSchema.index({ telegramLinkToken: 1 }, { sparse: true });
UserSchema.index({ telegramChatId: 1 }, { sparse: true });

export const UserModel = mongoose.model<IUserDoc>('User', UserSchema);
