/**
 * MatchRejectionEvent — records why a title was rejected for a product.
 * Deduplicated by (rawTitle, shopId, productId, reason) — upserts increment occurrenceCount.
 * TTL: 7 days.
 */

import mongoose, { Schema, Document } from 'mongoose';

export type RejectionReason =
  | 'EXCLUDE_MATCH'
  | 'MISSING_TOKEN'
  | 'SCORE_TOO_LOW'
  | 'LANGUAGE_FILTERED';

export interface IMatchRejectionEventDoc extends Document {
  rawTitle: string;
  shopId: string;
  productId: string;
  phrase: string;
  reason: RejectionReason;
  details: string;
  lastSeenAt: Date;
  occurrenceCount: number;
  createdAt: Date;
}

const MatchRejectionEventSchema = new Schema<IMatchRejectionEventDoc>(
  {
    rawTitle: { type: String, required: true },
    shopId: { type: String, required: true },
    productId: { type: String, required: true },
    phrase: { type: String, required: true },
    reason: {
      type: String,
      enum: ['EXCLUDE_MATCH', 'MISSING_TOKEN', 'SCORE_TOO_LOW', 'LANGUAGE_FILTERED'],
      required: true,
    },
    details: { type: String, default: '' },
    lastSeenAt: { type: Date, required: true },
    occurrenceCount: { type: Number, default: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Deduplication index
MatchRejectionEventSchema.index(
  { rawTitle: 1, shopId: 1, productId: 1, reason: 1 },
  { unique: true },
);

// TTL index — documents expire 7 days after createdAt
MatchRejectionEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Query indexes
MatchRejectionEventSchema.index({ productId: 1, lastSeenAt: -1 });
MatchRejectionEventSchema.index({ shopId: 1, lastSeenAt: -1 });

export const MatchRejectionEventModel = mongoose.model<IMatchRejectionEventDoc>(
  'MatchRejectionEvent',
  MatchRejectionEventSchema,
);
