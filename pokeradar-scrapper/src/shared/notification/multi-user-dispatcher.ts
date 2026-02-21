/**
 * Multi-user notification dispatcher.
 * Handles fan-out from scrape results to multiple users based on their watch entries.
 * Creates channel-agnostic notification documents; the notifications service
 * resolves which channels (Telegram/Discord/etc.) to deliver to at delivery time.
 *
 * Design for scale (25K+ users):
 * - Preloads all watch entries and user targets in 2 DB queries at cycle start
 * - Zero per-result DB queries during scraping
 * - Total DB queries per cycle: 4 (3 preloads + 1 state flush) + 1 batch insert for notifications
 */

import { WatchlistProductInternal, ProductResult, ShopConfig } from '../types';
import { NotificationStateService } from './notification-state.service';
import { MongoUserRepository, UserNotificationTarget } from '../repositories/mongo/user.repository';
import {
  MongoUserWatchEntryRepository,
  UserWatchInfo,
} from '../repositories/mongo/user-watch-entry.repository';
import {
  MongoNotificationRepository,
  NotificationInsert,
} from '../repositories/mongo/notification.repository';
import { ILogger } from '../logger';

interface QueuedNotification {
  product: WatchlistProductInternal;
  result: ProductResult;
  shop: ShopConfig;
  userId: string;
  userMaxPrice: number;
}

export class MultiUserNotificationDispatcher {
  private watchersByProduct: Map<string, UserWatchInfo[]> = new Map();
  private userTargets: Map<string, UserNotificationTarget> = new Map();
  private messageQueue: QueuedNotification[] = [];

  constructor(
    private stateService: NotificationStateService,
    private userWatchEntryRepo: MongoUserWatchEntryRepository,
    private userRepo: MongoUserRepository,
    private notificationRepo: MongoNotificationRepository,
    private logger: ILogger,
  ) {}

  /**
   * Preloads all watch entries and user targets for the cycle.
   * Called once at cycle start — 2 DB queries total.
   * Returns the set of product IDs that have at least one active subscriber.
   */
  async preloadForCycle(allProductIds: string[]): Promise<Set<string>> {
    // 1. Batch load all active watchers for all products (1 DB query)
    this.watchersByProduct =
      await this.userWatchEntryRepo.getActiveWatchersByProductIds(allProductIds);

    // 2. Collect all unique user IDs
    const allUserIds = new Set<string>();
    for (const watchers of this.watchersByProduct.values()) {
      for (const watcher of watchers) {
        allUserIds.add(watcher.userId);
      }
    }

    // 3. Batch load user notification targets — only those with at least one channel (1 DB query)
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
   * Enqueues notifications for later batch insertion. Zero DB queries.
   */
  processResult(product: WatchlistProductInternal, result: ProductResult, shop: ShopConfig): void {
    const watchers = this.watchersByProduct.get(product.id);
    if (!watchers || watchers.length === 0) return;

    for (const watcher of watchers) {
      // Update tracked state for this user (detects reset conditions)
      this.stateService.updateTrackedState(watcher.userId, product.id, shop.id, result);

      // Check if result meets this user's criteria
      if (!result.isAvailable || result.price === null) continue;
      if (result.price > watcher.maxPrice) continue;

      // Check if user has any linked notification channel
      const target = this.userTargets.get(watcher.userId);
      if (!target?.hasAnyChannel) continue;

      // Check notification state (avoid duplicate sends)
      if (!this.stateService.shouldNotify(watcher.userId, product.id, shop.id)) {
        continue;
      }

      this.messageQueue.push({
        product,
        result,
        shop,
        userId: watcher.userId,
        userMaxPrice: watcher.maxPrice,
      });
    }
  }

  /**
   * Inserts all enqueued notifications as channel-agnostic documents.
   * The notifications service resolves delivery channels at delivery time.
   * Marks notification state as notified for each queued notification.
   */
  async flushNotifications(): Promise<void> {
    if (this.messageQueue.length === 0) return;

    this.logger.info('Flushing notifications', { count: this.messageQueue.length });

    const inserts: NotificationInsert[] = this.messageQueue.map((msg) => ({
      userId: msg.userId,
      payload: {
        productName: msg.product.name,
        shopName: msg.shop.name,
        shopId: msg.shop.id,
        productId: msg.product.id,
        price: msg.result.price!,
        maxPrice: msg.userMaxPrice,
        productUrl: msg.result.productUrl,
      },
    }));

    await this.notificationRepo.insertBatch(inserts);

    // Mark all as notified (scrapper's responsibility ends here)
    for (const msg of this.messageQueue) {
      this.stateService.markNotified(msg.userId, msg.product.id, msg.shop.id, msg.result);
    }

    this.logger.info('Notifications created', { count: inserts.length });
    this.messageQueue = [];
  }
}
