/**
 * Multi-user notification dispatcher.
 * Handles fan-out from scrape results to multiple users based on their watch entries.
 *
 * Design for scale (25K+ users):
 * - Preloads all watch entries and user targets in 2 DB queries at cycle start
 * - Zero per-result DB queries during scraping
 * - Rate-limited Telegram sending (25 msgs/sec, under Telegram's 30/sec limit)
 * - Total DB queries per cycle: 4 (3 preloads + 1 state flush)
 */

import { WatchlistProductInternal, ProductResult, ShopConfig } from '../types';
import { NotificationService } from './notification.service';
import { NotificationStateService } from './notification-state.service';
import { MongoUserRepository, UserNotificationTarget } from '../repositories/mongo/user.repository';
import { MongoUserWatchEntryRepository, UserWatchInfo } from '../repositories/mongo/user-watch-entry.repository';
import { ILogger } from '../logger';

interface QueuedNotification {
  chatId: string;
  product: WatchlistProductInternal;
  result: ProductResult;
  shop: ShopConfig;
  userId: string;
  userMaxPrice: number;
}

const TELEGRAM_BATCH_SIZE = 25;
const TELEGRAM_BATCH_INTERVAL_MS = 1100;

export class MultiUserNotificationDispatcher {
  private watchersByProduct: Map<string, UserWatchInfo[]> = new Map();
  private userTargets: Map<string, UserNotificationTarget> = new Map();
  private messageQueue: QueuedNotification[] = [];

  constructor(
    private notificationService: NotificationService,
    private stateService: NotificationStateService,
    private userWatchEntryRepo: MongoUserWatchEntryRepository,
    private userRepo: MongoUserRepository,
    private logger: ILogger
  ) {}

  /**
   * Preloads all watch entries and user targets for the cycle.
   * Called once at cycle start — 2 DB queries total.
   * Returns the set of product IDs that have at least one active subscriber.
   */
  async preloadForCycle(allProductIds: string[]): Promise<Set<string>> {
    // 1. Batch load all active watchers for all products (1 DB query)
    this.watchersByProduct = await this.userWatchEntryRepo.getActiveWatchersByProductIds(allProductIds);

    // 2. Collect all unique user IDs
    const allUserIds = new Set<string>();
    for (const watchers of this.watchersByProduct.values()) {
      for (const watcher of watchers) {
        allUserIds.add(watcher.userId);
      }
    }

    // 3. Batch load user notification targets — only those with telegramChatId (1 DB query)
    this.userTargets = await this.userRepo.getNotificationTargets([...allUserIds]);

    const subscribedProductIds = new Set(this.watchersByProduct.keys());

    this.logger.info('Dispatcher preloaded for cycle', {
      subscribedProducts: subscribedProductIds.size,
      totalWatchers: allUserIds.size,
      notificationTargets: this.userTargets.size,
    });

    return subscribedProductIds;
  }

  /**
   * Processes a scrape result against all watching users.
   * Enqueues notifications for later batch sending. Zero DB queries.
   */
  processResult(
    product: WatchlistProductInternal,
    result: ProductResult,
    shop: ShopConfig
  ): void {
    const watchers = this.watchersByProduct.get(product.id);
    if (!watchers || watchers.length === 0) return;

    for (const watcher of watchers) {
      // Update tracked state for this user (detects reset conditions)
      this.stateService.updateTrackedState(watcher.userId, product.id, shop.id, result);

      // Check if result meets this user's criteria
      if (!result.isAvailable || result.price === null) continue;
      if (result.price > watcher.maxPrice) continue;

      // Check if user has a linked Telegram
      const target = this.userTargets.get(watcher.userId);
      if (!target) continue;

      // Check notification state (avoid duplicate sends)
      if (!this.stateService.shouldNotify(watcher.userId, product.id, shop.id)) {
        continue;
      }

      this.messageQueue.push({
        chatId: target.telegramChatId,
        product,
        result,
        shop,
        userId: watcher.userId,
        userMaxPrice: watcher.maxPrice,
      });
    }
  }

  /**
   * Sends all enqueued notifications with rate limiting.
   * Telegram limit: 30 messages/second to different chats.
   * We use 25/sec with 1.1s intervals for safety margin.
   */
  async flushNotifications(): Promise<void> {
    if (this.messageQueue.length === 0) return;

    this.logger.info('Flushing notifications', { count: this.messageQueue.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < this.messageQueue.length; i += TELEGRAM_BATCH_SIZE) {
      const batch = this.messageQueue.slice(i, i + TELEGRAM_BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (msg) => {
          await this.notificationService.sendAlert(
            msg.chatId,
            msg.product,
            msg.result,
            msg.shop,
            msg.userMaxPrice
          );
          // Mark as notified only on successful send
          this.stateService.markNotified(msg.userId, msg.product.id, msg.shop.id, msg.result);
        })
      );

      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          successCount++;
        } else {
          failCount++;
          const msg = batch[j];
          this.logger.error('Failed to send notification', {
            userId: msg.userId,
            product: msg.product.id,
            shop: msg.shop.id,
            error: (results[j] as PromiseRejectedResult).reason?.message,
          });
        }
      }

      // Rate limit: wait between batches
      if (i + TELEGRAM_BATCH_SIZE < this.messageQueue.length) {
        await new Promise((resolve) => setTimeout(resolve, TELEGRAM_BATCH_INTERVAL_MS));
      }
    }

    this.logger.info('Notifications flushed', { sent: successCount, failed: failCount });
    this.messageQueue = [];
  }
}
