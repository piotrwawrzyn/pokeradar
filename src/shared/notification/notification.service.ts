/**
 * Telegram notification service for product alerts.
 */

import TelegramBot from 'node-telegram-bot-api';
import { WatchlistProductInternal, ProductResult, ShopConfig } from '../types';
import { ILogger } from '../logger';

/**
 * Sends Telegram notifications for product availability alerts.
 */
export class NotificationService {
  private bot: TelegramBot;
  private chatId: string;

  constructor(
    token: string,
    chatId: string,
    private logger?: ILogger
  ) {
    this.bot = new TelegramBot(token, { polling: false });
    this.chatId = chatId;
  }

  /**
   * Sends a Telegram alert when a product meets criteria.
   */
  async sendAlert(
    product: WatchlistProductInternal,
    result: ProductResult,
    shop: ShopConfig
  ): Promise<void> {
    try {
      const message = this.formatMessage(product, result, shop);

      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      });

      this.logger?.info('Telegram notification sent', {
        product: product.id,
        shop: shop.id,
        price: result.price,
      });
    } catch (error) {
      this.logger?.error('Failed to send Telegram notification', {
        product: product.id,
        shop: shop.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Formats the notification message.
   */
  private formatMessage(
    product: WatchlistProductInternal,
    result: ProductResult,
    shop: ShopConfig
  ): string {
    const priceStr = result.price !== null ? `${result.price.toFixed(2)} zł` : 'N/A';
    const maxPriceStr = `${product.price.max.toFixed(2)} zł`;

    return `
🎯 *Product Available!*

📦 ${product.name}
🏪 Shop: ${shop.name}
💰 Price: ${priceStr} (max: ${maxPriceStr})
✅ Status: Available

🔗 [View Product](${result.productUrl})
    `.trim();
  }
}
