/**
 * Core notification processor.
 * Receives notification documents, delivers them via the appropriate channel,
 * and updates their status in MongoDB.
 * Handles retries with exponential backoff and rate limiting.
 */

import { INotificationDoc, NotificationModel } from '../infrastructure/database';
import { INotificationChannel } from '../infrastructure/channels';
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

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        if (rateLimiter) {
          await rateLimiter.acquire();
        }

        await channel.send(doc.channelTarget, doc.payload);
        await this.markSent(doc);

        this.logger.debug('Notification delivered', {
          id: doc._id?.toString(),
          channel: doc.channel,
          attempt,
        });
        return;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (attempt === this.retryConfig.maxAttempts) {
          this.logger.error('Notification delivery failed permanently', {
            id: doc._id?.toString(),
            channel: doc.channel,
            attempts: attempt,
            error: errorMsg,
          });
          await this.markFailed(doc, errorMsg, attempt);
          return;
        }

        const delay = Math.min(
          this.retryConfig.initialDelayMs * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelayMs
        );

        this.logger.warn('Notification delivery failed, retrying', {
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
