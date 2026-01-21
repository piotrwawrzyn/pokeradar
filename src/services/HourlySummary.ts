/**
 * Hourly Summary Service
 *
 * Sends a Telegram message once per hour with the best available price
 * for each item in the watchlist, or indicates if item was not found.
 *
 * This is a temporary feature - delete this file to remove it.
 */
import * as fs from 'fs';
import * as path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import { ShopConfig, WatchlistProductInternal, Watchlist, ProductResult } from '../types';
import { ScraperFactory } from '../scrapers/ScraperFactory';
import { Logger } from './Logger';
import { toInternalProducts } from '../utils/productUtils';

interface BestPrice {
  product: WatchlistProductInternal;
  price: number | null;
  shop: ShopConfig | null;
  url: string | null;
  isAvailable: boolean;
}

export class HourlySummary {
  private bot: TelegramBot;
  private chatId: string;
  private logger: Logger;
  private shops: ShopConfig[] = [];
  private products: WatchlistProductInternal[] = [];
  private intervalId?: NodeJS.Timeout;
  private hourlyIntervalMs = 60 * 60 * 1000; // 1 hour

  constructor(telegramToken: string, telegramChatId: string, logger?: Logger) {
    this.bot = new TelegramBot(telegramToken, { polling: false });
    this.chatId = telegramChatId;
    this.logger = logger || new Logger();
  }

  /**
   * Initialize by loading shops and watchlist configurations.
   */
  initialize(): void {
    this.loadShops();
    this.loadWatchlist();
    this.logger.info('HourlySummary initialized', {
      shops: this.shops.length,
      products: this.products.length
    });
  }

  private loadShops(): void {
    const shopsDir = path.join(__dirname, '../config/shops');
    if (!fs.existsSync(shopsDir)) {
      throw new Error(`Shops directory not found: ${shopsDir}`);
    }

    const files = fs.readdirSync(shopsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(shopsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const shop: ShopConfig = JSON.parse(content);
      this.shops.push(shop);
    }
  }

  private loadWatchlist(): void {
    const watchlistPath = path.join(__dirname, '../config/watchlist.json');
    if (!fs.existsSync(watchlistPath)) {
      throw new Error(`Watchlist not found: ${watchlistPath}`);
    }

    const content = fs.readFileSync(watchlistPath, 'utf-8');
    const watchlist: Watchlist = JSON.parse(content);
    this.products = toInternalProducts(watchlist.products);
  }

  /**
   * Scans all shops for all products and finds the best price for each.
   */
  async collectBestPrices(): Promise<BestPrice[]> {
    const bestPrices: BestPrice[] = [];

    for (const product of this.products) {
      let bestPrice: BestPrice = {
        product,
        price: null,
        shop: null,
        url: null,
        isAvailable: false
      };

      for (const shop of this.shops) {
        try {
          const scraper = ScraperFactory.create(shop, this.logger);
          const result = await scraper.scrapeProduct(product);

          this.logger.debug('HourlySummary scan result', {
            product: product.id,
            shop: shop.id,
            price: result.price,
            available: result.isAvailable
          });

          // Update best price if this is available and cheaper (or first available)
          if (result.isAvailable && result.price !== null) {
            if (bestPrice.price === null || result.price < bestPrice.price) {
              bestPrice = {
                product,
                price: result.price,
                shop,
                url: result.productUrl,
                isAvailable: true
              };
            }
          }
        } catch (error) {
          this.logger.error('HourlySummary error scanning product', {
            product: product.id,
            shop: shop.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      bestPrices.push(bestPrice);
    }

    return bestPrices;
  }

  /**
   * Formats the summary message for Telegram.
   */
  formatSummaryMessage(bestPrices: BestPrice[]): string {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('pl-PL');

    let message = `📊 *Hourly Price Summary*\n`;
    message += `📅 ${dateStr} ${timeStr}\n`;
    message += `─────────────────────\n\n`;

    const available = bestPrices.filter(bp => bp.isAvailable);
    const notFound = bestPrices.filter(bp => !bp.isAvailable);

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
        message += `🏪 ${bp.shop!.name}\n`;
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

    message += `\n─────────────────────\n`;
    message += `🔍 Scanned ${this.shops.length} shops`;

    return message;
  }

  /**
   * Runs a single summary cycle: collects prices and sends message.
   */
  async runSummaryCycle(): Promise<void> {
    this.logger.info('HourlySummary: Starting summary cycle');

    try {
      const bestPrices = await this.collectBestPrices();
      const message = this.formatSummaryMessage(bestPrices);

      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

      this.logger.info('HourlySummary: Summary sent successfully', {
        available: bestPrices.filter(bp => bp.isAvailable).length,
        notFound: bestPrices.filter(bp => !bp.isAvailable).length
      });
    } catch (error) {
      this.logger.error('HourlySummary: Failed to send summary', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Starts the hourly summary service.
   */
  start(): void {
    this.logger.info('HourlySummary: Starting hourly summary service');

    // Run immediately on start
    this.runSummaryCycle().catch(error => {
      this.logger.error('HourlySummary: Error in initial cycle', {
        error: error instanceof Error ? error.message : String(error)
      });
    });

    // Then run every hour
    this.intervalId = setInterval(() => {
      this.runSummaryCycle().catch(error => {
        this.logger.error('HourlySummary: Error in summary cycle', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, this.hourlyIntervalMs);

    this.logger.info('HourlySummary: Service started (interval: 1 hour)');
  }

  /**
   * Stops the hourly summary service.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.logger.info('HourlySummary: Service stopped');
    }
  }
}
