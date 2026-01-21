/**
 * Summary Service
 *
 * Sends a Telegram message at a configurable interval with the best available
 * price for each item in the watchlist, or indicates if item was not found.
 *
 * This service collects data from the main PriceMonitor scrapes and aggregates
 * the best prices for each product.
 *
 * This is a temporary feature - delete this file to remove it.
 */
import TelegramBot from 'node-telegram-bot-api';
import { ShopConfig, WatchlistProductInternal, ProductResult } from '../types';
import { Logger } from './Logger';

interface BestPrice {
  product: WatchlistProductInternal;
  price: number | null;
  shopName: string | null;
  url: string | null;
  isAvailable: boolean;
}

export class SummaryService {
  private bot: TelegramBot;
  private chatId: string;
  private logger: Logger;
  private intervalId?: NodeJS.Timeout;
  private intervalMs: number;

  // Stores best prices collected from PriceMonitor scrapes
  // Key: productId, Value: BestPrice
  private bestPrices: Map<string, BestPrice> = new Map();

  constructor(telegramToken: string, telegramChatId: string, intervalMs: number = 3600000, logger?: Logger) {
    this.bot = new TelegramBot(telegramToken, { polling: false });
    this.chatId = telegramChatId;
    this.intervalMs = intervalMs;
    this.logger = logger || new Logger();
  }

  /**
   * Called by PriceMonitor after each product scan to record the result.
   * Updates best price if this result is better (available and cheaper).
   */
  recordResult(product: WatchlistProductInternal, result: ProductResult, shop: ShopConfig): void {
    const existing = this.bestPrices.get(product.id);

    // Update if: no existing data, or this is available and cheaper
    if (result.isAvailable && result.price !== null) {
      if (!existing || !existing.isAvailable || existing.price === null || result.price < existing.price) {
        this.bestPrices.set(product.id, {
          product,
          price: result.price,
          shopName: shop.name,
          url: result.productUrl,
          isAvailable: true
        });
      }
    } else if (!existing) {
      // Record as not found if we have no data yet
      this.bestPrices.set(product.id, {
        product,
        price: null,
        shopName: null,
        url: null,
        isAvailable: false
      });
    }
  }

  /**
   * Formats the summary message for Telegram.
   */
  private formatSummaryMessage(): string {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('pl-PL');

    let message = `📊 *Price Summary*\n`;
    message += `📅 ${dateStr} ${timeStr}\n`;
    message += `─────────────────────\n\n`;

    const allPrices = Array.from(this.bestPrices.values());
    const available = allPrices.filter(bp => bp.isAvailable);
    const notFound = allPrices.filter(bp => !bp.isAvailable);

    // Available items section
    if (available.length > 0) {
      message += `✅ *Available Items (${available.length})*\n\n`;

      for (const bp of available) {
        const priceStr = bp.price!.toFixed(2);
        const maxPriceStr = bp.product.price.max.toFixed(2);
        const meetsMax = bp.price! <= bp.product.price.max;
        const priceIndicator = meetsMax ? '💚' : '🔴';

        message += `📦 *${bp.product.name}*\n`;
        message += `${priceIndicator} ${priceStr} zł (max: ${maxPriceStr} zł)\n`;
        message += `🏪 ${bp.shopName}\n`;
        message += `🔗 [View Product](${bp.url})\n\n`;
      }
    }

    // Not found items section
    if (notFound.length > 0) {
      message += `❌ *Not Found (${notFound.length})*\n\n`;

      for (const bp of notFound) {
        message += `• ${bp.product.name}\n`;
      }
    }

    if (allPrices.length === 0) {
      message += `_No data collected yet_\n`;
    }

    message += `\n─────────────────────`;

    return message;
  }

  /**
   * Sends the summary message and resets collected data.
   */
  private async sendSummary(): Promise<void> {
    if (this.bestPrices.size === 0) {
      this.logger.info('SummaryService: No data to send, skipping summary');
      return;
    }

    this.logger.info('SummaryService: Sending summary');

    try {
      const message = this.formatSummaryMessage();

      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

      const available = Array.from(this.bestPrices.values()).filter(bp => bp.isAvailable).length;
      const notFound = Array.from(this.bestPrices.values()).filter(bp => !bp.isAvailable).length;

      this.logger.info('SummaryService: Summary sent successfully', {
        available,
        notFound
      });

      // Reset data for next interval
      this.bestPrices.clear();
    } catch (error) {
      this.logger.error('SummaryService: Failed to send summary', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Starts the summary service.
   */
  start(): void {
    const intervalMinutes = Math.round(this.intervalMs / 60000);
    this.logger.info(`SummaryService: Starting (interval: ${intervalMinutes} minutes)`);

    this.intervalId = setInterval(() => {
      this.sendSummary().catch(error => {
        this.logger.error('SummaryService: Error in summary cycle', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, this.intervalMs);
  }

  /**
   * Stops the summary service.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.logger.info('SummaryService: Service stopped');
    }
  }
}
