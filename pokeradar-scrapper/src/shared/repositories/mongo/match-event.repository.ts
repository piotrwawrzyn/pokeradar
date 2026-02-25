/**
 * MatchEventRepository — fire-and-forget writes to match event collections.
 * Never throws — failures are silently swallowed to avoid disrupting the scraping pipeline.
 */

import {
  MatchRejectionEventModel,
  MatchConfirmationEventModel,
  PendingMatchModel,
} from '../../../infrastructure/database/models';
import type {
  RejectionReason,
  MatchBandValue,
  ConfirmationSource,
  PendingMatchSource,
} from '@pokeradar/shared';

export class MatchEventRepository {
  /**
   * Records a title rejection event.
   * Upserts: increments occurrenceCount and updates lastSeenAt if entry already exists.
   */
  recordRejection(params: {
    rawTitle: string;
    shopId: string;
    productId: string;
    phrase: string;
    reason: RejectionReason;
    details?: string;
  }): void {
    const now = new Date();
    MatchRejectionEventModel.findOneAndUpdate(
      {
        rawTitle: params.rawTitle,
        shopId: params.shopId,
        productId: params.productId,
        reason: params.reason,
      },
      {
        $set: { phrase: params.phrase, details: params.details ?? '', lastSeenAt: now },
        $inc: { occurrenceCount: 1 },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, new: false },
    ).catch(() => {
      // Silently ignore — event recording must not disrupt scraping
    });
  }

  /**
   * Records a confirmed match (HIGH confidence AUTO or ADMIN action).
   */
  recordConfirmation(params: {
    rawTitle: string;
    shopId: string;
    productId: string;
    matchBand: MatchBandValue;
    source: ConfirmationSource;
  }): void {
    MatchConfirmationEventModel.create({
      rawTitle: params.rawTitle,
      shopId: params.shopId,
      productId: params.productId,
      matchBand: params.matchBand,
      source: params.source,
      confirmedAt: new Date(),
    }).catch(() => {
      // Silently ignore
    });
  }

  /**
   * Creates a PendingMatch document for MEDIUM-confidence matches requiring admin review.
   * Skips if a PENDING entry already exists for this (rawTitle, shopId) combination.
   */
  recordPendingMatch(params: {
    rawTitle: string;
    shopId: string;
    productId: string;
    confidence: number;
    phrase: string;
    source: PendingMatchSource;
  }): void {
    PendingMatchModel.findOneAndUpdate(
      { rawTitle: params.rawTitle, shopId: params.shopId, status: 'PENDING' },
      {
        $setOnInsert: {
          rawTitle: params.rawTitle,
          shopId: params.shopId,
          productId: params.productId,
          confidence: params.confidence,
          phrase: params.phrase,
          source: params.source,
          status: 'PENDING',
        },
      },
      { upsert: true, new: false },
    ).catch(() => {
      // Silently ignore
    });
  }
}
