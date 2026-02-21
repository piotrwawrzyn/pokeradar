/**
 * Core notification processor.
 * Receives channel-agnostic notification documents, looks up which channels
 * the user has configured, then delivers to each via the appropriate adapter.
 * Each delivery is tracked independently in the `deliveries` subdocument array.
 * Handles retries with exponential backoff and rate limiting per channel.
 */

import { INotificationDoc, IDelivery, NotificationChannel, NotificationModel, UserModel } from '@pokeradar/shared';
import { INotificationChannel } from './channels';
import { RateLimiter } from './rate-limiter';
import { ILogger } from '../shared/logger';

interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

export class NotificationProcessor {
  private channels: Map<string, INotificationChannel> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private processing = false;
  private queue: INotificationDoc[] = [];
  private processedIds = new Set<string>();
  private drainResolve: (() => void) | null = null;

  constructor(
    private retryConfig: RetryConfig,
    private logger: ILogger
  ) {}

  /**
   * Registers a notification channel with its rate limiter.
   */
  registerChannel(channel: INotificationChannel, rateLimiter: RateLimiter): void {
    this.channels.set(channel.name, channel);
    this.rateLimiters.set(channel.name, rateLimiter);
    this.logger.info('Registered channel', { channel: channel.name });
  }

  /**
   * Enqueues a notification for processing.
   */
  enqueue(doc: INotificationDoc): void {
    const id = doc._id?.toString();
    if (id && this.processedIds.has(id)) {
      return;
    }
    this.queue.push(doc);
    this.processQueue();
  }

  /**
   * Enqueues multiple notifications for processing.
   */
  enqueueBatch(docs: INotificationDoc[]): void {
    this.queue.push(...docs);
    this.processQueue();
  }

  /**
   * Waits until the queue is fully drained.
   */
  async drain(): Promise<void> {
    if (this.queue.length === 0 && !this.processing) return;
    return new Promise((resolve) => {
      this.drainResolve = resolve;
    });
  }

  /**
   * Processes pending notifications from the database (startup recovery).
   */
  async recoverPending(): Promise<number> {
    // Notifications stuck in 'sending' may have partial deliveries — reset to 'pending'
    // so we re-process and complete any failed deliveries.
    const stuckSending = await NotificationModel.updateMany(
      { status: 'sending' },
      { $set: { status: 'pending' } }
    );
    if (stuckSending.modifiedCount > 0) {
      this.logger.info('Reset stuck sending notifications to pending', {
        count: stuckSending.modifiedCount,
      });
    }

    const pendingDocs = await NotificationModel.find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .lean();

    if (pendingDocs.length > 0) {
      this.logger.info('Recovering pending notifications', { count: pendingDocs.length });
      this.enqueueBatch(pendingDocs as INotificationDoc[]);
    }

    return pendingDocs.length;
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const doc = this.queue.shift()!;
        await this.processOne(doc);
      }
    } finally {
      this.processing = false;
      if (this.drainResolve && this.queue.length === 0) {
        this.drainResolve();
        this.drainResolve = null;
      }
    }
  }

  private async processOne(doc: INotificationDoc): Promise<void> {
    const id = doc._id?.toString();
    if (id) this.processedIds.add(id);

    // If deliveries array is empty, this is a freshly created notification.
    // Populate it by looking up the user's configured channels.
    let deliveries = doc.deliveries ?? [];
    if (deliveries.length === 0) {
      deliveries = await this.buildDeliveries(doc.userId);
      if (deliveries.length === 0) {
        // User has no channels configured — mark as sent and move on
        this.logger.warn('No channels configured for user, skipping notification', { id, userId: doc.userId });
        await NotificationModel.updateOne({ _id: doc._id }, { $set: { status: 'sent', deliveries: [] } });
        return;
      }

      await NotificationModel.updateOne(
        { _id: doc._id },
        { $set: { status: 'sending', deliveries } }
      );
    } else {
      await NotificationModel.updateOne({ _id: doc._id }, { $set: { status: 'sending' } });
    }

    // Deliver to all channels concurrently, each with independent retry
    await Promise.allSettled(
      deliveries.map((delivery, idx) => this.deliverOne(doc, delivery, idx))
    );

    // Mark overall notification as 'sent' once all deliveries are settled
    await NotificationModel.updateOne({ _id: doc._id }, { $set: { status: 'sent' } });

    this.logger.info('Notification processing complete', {
      id,
      deliveries: deliveries.length,
    });
  }

  /**
   * Looks up a user's linked channels and builds the initial deliveries array.
   */
  private async buildDeliveries(userId: string): Promise<IDelivery[]> {
    const user = await UserModel.findById(userId).select('telegram discord').lean();
    if (!user) return [];

    const deliveries: IDelivery[] = [];

    if (user.telegram?.channelId) {
      deliveries.push({
        channel: 'telegram' as NotificationChannel,
        channelTarget: user.telegram.channelId,
        status: 'pending',
        attempts: 0,
        error: null,
        sentAt: null,
      });
    }

    if (user.discord?.channelId) {
      deliveries.push({
        channel: 'discord' as NotificationChannel,
        channelTarget: user.discord.channelId,
        status: 'pending',
        attempts: 0,
        error: null,
        sentAt: null,
      });
    }

    return deliveries;
  }

  /**
   * Delivers a single channel entry with retries. Updates the delivery subdoc in DB.
   */
  private async deliverOne(doc: INotificationDoc, delivery: IDelivery, idx: number): Promise<void> {
    // Skip already-sent deliveries (e.g. from a recovered notification)
    if (delivery.status === 'sent') return;

    const channel = this.channels.get(delivery.channel);
    if (!channel) {
      this.logger.error('Unknown channel in delivery, skipping', { channel: delivery.channel, id: doc._id?.toString() });
      await this.updateDelivery(doc, idx, 'failed', `Unknown channel: ${delivery.channel}`, 1, null);
      return;
    }

    const rateLimiter = this.rateLimiters.get(delivery.channel);
    let sent = false;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        if (!sent) {
          if (rateLimiter) await rateLimiter.acquire();
          await channel.send(delivery.channelTarget, doc.payload);
          sent = true;
        }

        const sentAt = new Date();
        await this.updateDelivery(doc, idx, 'sent', null, attempt, sentAt);

        this.logger.info('Delivery sent', {
          id: doc._id?.toString(),
          channel: delivery.channel,
          attempt,
        });
        return;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (attempt === this.retryConfig.maxAttempts) {
          this.logger.error('Delivery failed permanently', {
            id: doc._id?.toString(),
            channel: delivery.channel,
            attempts: attempt,
            sent,
            error: errorMsg,
          });
          await this.updateDelivery(doc, idx, 'failed', errorMsg, attempt, null).catch(() => {});
          return;
        }

        const delay = Math.min(
          this.retryConfig.initialDelayMs * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelayMs
        );

        this.logger.warn('Delivery failed, retrying', {
          id: doc._id?.toString(),
          channel: delivery.channel,
          attempt,
          nextRetryMs: delay,
          error: errorMsg,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async updateDelivery(
    doc: INotificationDoc,
    idx: number,
    status: 'sent' | 'failed',
    error: string | null,
    attempts: number,
    sentAt: Date | null
  ): Promise<void> {
    await NotificationModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          [`deliveries.${idx}.status`]: status,
          [`deliveries.${idx}.attempts`]: attempts,
          [`deliveries.${idx}.error`]: error,
          [`deliveries.${idx}.sentAt`]: sentAt,
        },
      }
    );
  }
}
