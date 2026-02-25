import axios from 'axios';
import {
  PendingMatchModel,
  MatchRejectionEventModel,
  MatchConfirmationEventModel,
  SuppressedTitleModel,
  ClassificationCorrectionModel,
} from '../../infrastructure/database/models';
import { ProductResultModel } from '@pokeradar/shared';
import { NotFoundError } from '../../shared/middleware';
import type { CorrectionReason } from '@pokeradar/shared';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL;

/** Fire-and-forget centroid update — called after any admin confirmation/correction. */
function triggerCentroidUpdate(productId: string): void {
  if (!ML_SERVICE_URL) return;
  axios.post(`${ML_SERVICE_URL}/centroid/update`, { productId }, { timeout: 5000 }).catch(() => {
    /* no-op — ML update failures must not affect admin flow */
  });
}

export class AdminMatchingService {
  /**
   * Returns all PENDING matches for admin review.
   */
  async getReviewQueue() {
    return PendingMatchModel.find({ status: 'PENDING' }).sort({ createdAt: -1 }).lean();
  }

  /**
   * Returns rejection events, filterable by productId / shopId / reason.
   */
  async getRejections(params: {
    productId?: string;
    shopId?: string;
    reason?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (params.productId) filter.productId = params.productId;
    if (params.shopId) filter.shopId = params.shopId;
    if (params.reason) filter.reason = params.reason;

    const [data, total] = await Promise.all([
      MatchRejectionEventModel.find(filter).sort({ lastSeenAt: -1 }).skip(skip).limit(limit).lean(),
      MatchRejectionEventModel.countDocuments(filter),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Returns the correction history audit log.
   */
  async getCorrections(params: { page?: number; limit?: number }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      ClassificationCorrectionModel.find().sort({ correctedAt: -1 }).skip(skip).limit(limit).lean(),
      ClassificationCorrectionModel.countDocuments(),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Confirms a PENDING match as correct.
   * - Sets status = CONFIRMED
   * - Emits MatchConfirmationEvent (ADMIN_CONFIRMED)
   * - Writes SuppressedTitle
   */
  async confirmMatch(matchId: string, adminId: string) {
    const match = await PendingMatchModel.findById(matchId);
    if (!match) throw new NotFoundError('Pending match not found');
    if (match.status !== 'PENDING') throw new NotFoundError('Match is no longer pending');

    const now = new Date();

    match.status = 'CONFIRMED';
    match.resolvedAt = now;
    match.resolvedBy = adminId;
    await match.save();

    await Promise.all([
      MatchConfirmationEventModel.create({
        rawTitle: match.rawTitle,
        shopId: match.shopId,
        productId: match.productId,
        matchBand: 'MEDIUM',
        source: 'ADMIN_CONFIRMED',
        confirmedAt: now,
      }),
      SuppressedTitleModel.findOneAndUpdate(
        { rawTitle: match.rawTitle, shopId: match.shopId },
        {
          $setOnInsert: {
            rawTitle: match.rawTitle,
            shopId: match.shopId,
            reason: 'ADMIN_CONFIRMED',
            suppressedAt: now,
            suppressedBy: adminId,
          },
        },
        { upsert: true },
      ),
    ]);

    triggerCentroidUpdate(match.productId);
    return { ok: true };
  }

  /**
   * Corrects a PENDING match to a different product.
   * - Sets status = CORRECTED
   * - Deletes the wrong ProductResult
   * - Emits MatchConfirmationEvent (ADMIN_CORRECTED) for correct product
   * - Stores ClassificationCorrection audit entry
   * - Writes SuppressedTitle
   */
  async correctMatch(
    matchId: string,
    adminId: string,
    body: { correctProductId: string; reason: CorrectionReason },
  ) {
    const match = await PendingMatchModel.findById(matchId);
    if (!match) throw new NotFoundError('Pending match not found');
    if (match.status !== 'PENDING') throw new NotFoundError('Match is no longer pending');

    const now = new Date();

    match.status = 'CORRECTED';
    match.resolvedAt = now;
    match.resolvedBy = adminId;
    await match.save();

    await Promise.all([
      // Delete the wrong ProductResult from the matched shop
      ProductResultModel.deleteOne({
        productId: match.productId,
        shopId: match.shopId,
      }),

      // Emit confirmation for the correct product
      MatchConfirmationEventModel.create({
        rawTitle: match.rawTitle,
        shopId: match.shopId,
        productId: body.correctProductId,
        matchBand: 'MEDIUM',
        source: 'ADMIN_CORRECTED',
        confirmedAt: now,
      }),

      // Store correction audit
      ClassificationCorrectionModel.create({
        rawTitle: match.rawTitle,
        shopId: match.shopId,
        originalProductId: match.productId,
        correctedProductId: body.correctProductId,
        reason: body.reason,
        correctedAt: now,
        adminId,
      }),

      // Suppress title
      SuppressedTitleModel.findOneAndUpdate(
        { rawTitle: match.rawTitle, shopId: match.shopId },
        {
          $setOnInsert: {
            rawTitle: match.rawTitle,
            shopId: match.shopId,
            reason: 'ADMIN_CORRECTED',
            suppressedAt: now,
            suppressedBy: adminId,
          },
        },
        { upsert: true },
      ),
    ]);

    // Update centroids for both products (original was wrong, correct one gains a training point)
    triggerCentroidUpdate(match.productId);
    triggerCentroidUpdate(body.correctProductId);
    return { ok: true };
  }

  /**
   * Rejects a PENDING match (non-English / false positive).
   * - Sets status = REJECTED
   * - Writes SuppressedTitle
   */
  async rejectMatch(matchId: string, adminId: string, reason: 'NON_ENGLISH' | 'FALSE_POSITIVE') {
    const match = await PendingMatchModel.findById(matchId);
    if (!match) throw new NotFoundError('Pending match not found');
    if (match.status !== 'PENDING') throw new NotFoundError('Match is no longer pending');

    const now = new Date();

    match.status = 'REJECTED';
    match.resolvedAt = now;
    match.resolvedBy = adminId;
    await match.save();

    await SuppressedTitleModel.findOneAndUpdate(
      { rawTitle: match.rawTitle, shopId: match.shopId },
      {
        $setOnInsert: {
          rawTitle: match.rawTitle,
          shopId: match.shopId,
          reason,
          suppressedAt: now,
          suppressedBy: adminId,
        },
      },
      { upsert: true },
    );

    return { ok: true };
  }
}
