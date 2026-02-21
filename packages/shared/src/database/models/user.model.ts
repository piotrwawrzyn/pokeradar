import mongoose, { Schema, Document } from 'mongoose';

export interface IChannelData {
  channelId: string | null;
  linkToken: string | null;
}

export interface IUserDoc extends Document {
  clerkId: string;
  telegram: IChannelData;
  discord: IChannelData;
  createdAt: Date;
  updatedAt: Date;
}

const ChannelSchema = new Schema<IChannelData>(
  {
    channelId: { type: String, default: null },
    linkToken: { type: String, default: null },
  },
  { _id: false },
);

const UserSchema = new Schema<IUserDoc>(
  {
    clerkId: { type: String, required: true, unique: true },
    telegram: { type: ChannelSchema, default: () => ({ channelId: null, linkToken: null }) },
    discord: { type: ChannelSchema, default: () => ({ channelId: null, linkToken: null }) },
  },
  { timestamps: true },
);

UserSchema.index({ 'telegram.linkToken': 1 }, { sparse: true });
UserSchema.index({ 'telegram.channelId': 1 }, { sparse: true });
UserSchema.index({ 'discord.linkToken': 1 }, { sparse: true });
UserSchema.index({ 'discord.channelId': 1 }, { sparse: true });

export const UserModel = mongoose.model<IUserDoc>('User', UserSchema);
