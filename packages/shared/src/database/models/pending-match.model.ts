/**
 * PendingMatch — MEDIUM-confidence matches awaiting admin review.
 * Deduplicated: only one PENDING entry per (rawTitle, shopId) at a time.
 */

import mongoose, { Schema, Document } from 'mongoose';

export type PendingMatchStatus = 'PENDING' | 'CONFIRMED' | 'CORRECTED' | 'REJECTED';
export type PendingMatchSource = 'AUTO_MEDIUM' | 'AUTO_ML';

export interface IPendingMatchDoc extends Document {
  rawTitle: string;
  shopId: string;
  productId: string;
  confidence: number;
  phrase: string;
  source: PendingMatchSource;
  status: PendingMatchStatus;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PendingMatchSchema = new Schema<IPendingMatchDoc>(
  {
    rawTitle: { type: String, required: true },
    shopId: { type: String, required: true },
    productId: { type: String, required: true },
    confidence: { type: Number, required: true },
    phrase: { type: String, required: true },
    source: { type: String, enum: ['AUTO_MEDIUM', 'AUTO_ML'], required: true },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CORRECTED', 'REJECTED'],
      default: 'PENDING',
    },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
  },
  { timestamps: true },
);

// Only one PENDING entry per (rawTitle, shopId)
PendingMatchSchema.index(
  { rawTitle: 1, shopId: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } },
);

PendingMatchSchema.index({ status: 1, createdAt: -1 });
PendingMatchSchema.index({ productId: 1 });

export const PendingMatchModel = mongoose.model<IPendingMatchDoc>(
  'PendingMatch',
  PendingMatchSchema,
);
