import mongoose, { Schema, Document } from 'mongoose';

export interface IAppSettingsDoc extends Document {
  signupsEnabled: boolean;
  loginEnabled: boolean;
  updatedAt: Date;
}

const AppSettingsSchema = new Schema<IAppSettingsDoc>(
  {
    signupsEnabled: { type: Boolean, default: true },
    loginEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const AppSettingsModel = mongoose.model<IAppSettingsDoc>(
  'AppSettings',
  AppSettingsSchema
);

export async function getAppSettings(): Promise<IAppSettingsDoc> {
  let settings = await AppSettingsModel.findOne();
  if (!settings) {
    settings = await AppSettingsModel.create({});
  }
  return settings;
}
