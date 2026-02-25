/**
 * SuppressedTitle — permanent suppression list.
 * Prevents resolved titles from re-entering the ML pipeline every 5-minute cycle.
 * Written after any admin resolution (confirm/correct/reject).
 */

import mongoose, { Schema, Document } from 'mongoose';

export type SuppressedReason =
  | 'ADMIN_CONFIRMED'
  | 'ADMIN_CORRECTED'
  | 'NON_ENGLISH'
  | 'FALSE_POSITIVE';

export interface ISuppressedTitleDoc extends Document {
  rawTitle: string;
  shopId: string;
  reason: SuppressedReason;
  suppressedAt: Date;
  suppressedBy: string;
  expiresAt?: Date;
}

const SuppressedTitleSchema = new Schema<ISuppressedTitleDoc>(
  {
    rawTitle: { type: String, required: true },
    shopId: { type: String, required: true },
    reason: {
      type: String,
      enum: ['ADMIN_CONFIRMED', 'ADMIN_CORRECTED', 'NON_ENGLISH', 'FALSE_POSITIVE'],
      required: true,
    },
    suppressedAt: { type: Date, required: true },
    suppressedBy: { type: String, required: true },
    expiresAt: { type: Date },
  },
  { timestamps: false },
);

SuppressedTitleSchema.index({ rawTitle: 1, shopId: 1 }, { unique: true });

// Sparse TTL index for optional expiry
SuppressedTitleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

export const SuppressedTitleModel = mongoose.model<ISuppressedTitleDoc>(
  'SuppressedTitle',
  SuppressedTitleSchema,
);
