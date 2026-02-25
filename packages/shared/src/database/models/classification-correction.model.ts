/**
 * ClassificationCorrection — audit log of admin corrections to ML/auto matches.
 */

import mongoose, { Schema, Document } from 'mongoose';

export type CorrectionReason = 'WRONG_TYPE' | 'WRONG_SET' | 'NON_ENGLISH' | 'FALSE_POSITIVE';

export interface IClassificationCorrectionDoc extends Document {
  rawTitle: string;
  shopId: string;
  originalProductId: string;
  correctedProductId: string;
  reason: CorrectionReason;
  correctedAt: Date;
  adminId: string;
}

const ClassificationCorrectionSchema = new Schema<IClassificationCorrectionDoc>(
  {
    rawTitle: { type: String, required: true },
    shopId: { type: String, required: true },
    originalProductId: { type: String, required: true },
    correctedProductId: { type: String, required: true },
    reason: {
      type: String,
      enum: ['WRONG_TYPE', 'WRONG_SET', 'NON_ENGLISH', 'FALSE_POSITIVE'],
      required: true,
    },
    correctedAt: { type: Date, required: true },
    adminId: { type: String, required: true },
  },
  { timestamps: false },
);

ClassificationCorrectionSchema.index({ correctedAt: -1 });
ClassificationCorrectionSchema.index({ originalProductId: 1 });

export const ClassificationCorrectionModel = mongoose.model<IClassificationCorrectionDoc>(
  'ClassificationCorrection',
  ClassificationCorrectionSchema,
);
