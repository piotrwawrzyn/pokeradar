/**
 * MatchConfirmationEvent — permanent ML training corpus.
 * Records confirmed matches (AUTO_HIGH, ADMIN_CONFIRMED, ADMIN_CORRECTED).
 */

import mongoose, { Schema, Document } from 'mongoose';

export type MatchBandValue = 'HIGH' | 'MEDIUM' | 'LOW';
export type ConfirmationSource = 'AUTO_HIGH' | 'AUTO_ML' | 'ADMIN_CONFIRMED' | 'ADMIN_CORRECTED';

export interface IMatchConfirmationEventDoc extends Document {
  rawTitle: string;
  shopId: string;
  productId: string;
  matchBand: MatchBandValue;
  source: ConfirmationSource;
  confirmedAt: Date;
  createdAt: Date;
}

const MatchConfirmationEventSchema = new Schema<IMatchConfirmationEventDoc>(
  {
    rawTitle: { type: String, required: true },
    shopId: { type: String, required: true },
    productId: { type: String, required: true },
    matchBand: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], required: true },
    source: {
      type: String,
      enum: ['AUTO_HIGH', 'AUTO_ML', 'ADMIN_CONFIRMED', 'ADMIN_CORRECTED'],
      required: true,
    },
    confirmedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

MatchConfirmationEventSchema.index({ productId: 1, confirmedAt: -1 });
MatchConfirmationEventSchema.index({ shopId: 1, confirmedAt: -1 });

export const MatchConfirmationEventModel = mongoose.model<IMatchConfirmationEventDoc>(
  'MatchConfirmationEvent',
  MatchConfirmationEventSchema,
);
