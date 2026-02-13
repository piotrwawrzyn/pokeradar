/**
 * Core notification processor.
 * Receives notification documents, delivers them via the appropriate channel,
 * and updates their status in MongoDB.
 * Handles retries with exponential backoff and rate limiting.
 */

import { INotificationDoc, NotificationModel } from '@pokeradar/shared';
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
    // Notifications stuck in 'sending' were already dispatched to Telegram
    // but the process crashed before marking them as 'sent'. Just mark them sent.
    const stuckSending = await NotificationModel.updateMany(
      { status: 'sending' },
      { $set: { status: 'sent', sentAt: new Date() } }
    );
    if (stuckSending.modifiedCount > 0) {
      this.logger.info('Marked stuck sending notifications as sent', {
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
    const channel = this.channels.get(doc.channel);
    if (!channel) {
      this.logger.error('Unknown channel, marking as failed', {
        id: doc._id?.toString(),
        channel: doc.channel,
      });
      await this.markFailed(doc, `Unknown channel: ${doc.channel}`, 1);
      return;
    }

    const rateLimiter = this.rateLimiters.get(doc.channel);
    let sent = false;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        if (!sent) {
          if (rateLimiter) {
            await rateLimiter.acquire();
          }

          await this.markSending(doc);
          await channel.send(doc.channelTarget, doc.payload);
          sent = true;
        }

        await this.markSent(doc);

        this.logger.info('Notification delivered', {
          id: doc._id?.toString(),
          channel: doc.channel,
          attempt,
        });
        return;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (attempt === this.retryConfig.maxAttempts) {
          // If we already sent to Telegram but can't update DB, log it clearly
          if (sent) {
            this.logger.error('Notification was sent but failed to update DB status', {
              id: doc._id?.toString(),
              channel: doc.channel,
              error: errorMsg,
            });
          } else {
            this.logger.error('Notification delivery failed permanently', {
              id: doc._id?.toString(),
              channel: doc.channel,
              attempts: attempt,
              error: errorMsg,
            });
          }
          await this.markFailed(doc, errorMsg, attempt).catch(() => {});
          return;
        }

        const delay = Math.min(
          this.retryConfig.initialDelayMs * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelayMs
        );

        this.logger.warn(sent ? 'Failed to update DB status, retrying' : 'Notification delivery failed, retrying', {
          id: doc._id?.toString(),
          channel: doc.channel,
          attempt,
          nextRetryMs: delay,
          error: errorMsg,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async markSending(doc: INotificationDoc): Promise<void> {
    await NotificationModel.updateOne(
      { _id: doc._id },
      { $set: { status: 'sending' } }
    );
  }

  private async markSent(doc: INotificationDoc): Promise<void> {
    await NotificationModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: 'sent',
          sentAt: new Date(),
        },
      }
    );
  }

  private async markFailed(doc: INotificationDoc, error: string, attempts: number): Promise<void> {
    await NotificationModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: 'failed',
          error,
          attempts,
        },
      }
    );
  }
}
