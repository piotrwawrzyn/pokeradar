/**
 * Telegram notification service for product alerts.
 * Multi-user: chatId is provided per-call, not hardcoded.
 */

import TelegramBot from 'node-telegram-bot-api';
import { WatchlistProductInternal, ProductResult, ShopConfig } from '../types';
import { ILogger } from '../logger';

/**
 * Sends Telegram notifications for product availability alerts.
 */
export class NotificationService {
  private bot: TelegramBot;

  constructor(
    token: string,
    private logger?: ILogger
  ) {
    this.bot = new TelegramBot(token, { polling: false });
  }

  /**
   * Sends a Telegram alert to a specific user's chat.
   */
  async sendAlert(
    chatId: string,
    product: WatchlistProductInternal,
    result: ProductResult,
    shop: ShopConfig,
    userMaxPrice: number
  ): Promise<void> {
    try {
      const message = this.formatMessage(product, result, shop, userMaxPrice);

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      });

      this.logger?.info('Telegram notification sent', {
        chatId,
        product: product.id,
        shop: shop.id,
        price: result.price,
      });
    } catch (error) {
      this.logger?.error('Failed to send Telegram notification', {
        chatId,
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
    shop: ShopConfig,
    userMaxPrice: number
  ): string {
    const priceStr = result.price !== null ? `${result.price.toFixed(2)} zł` : 'N/A';
    const maxPriceStr = `${userMaxPrice.toFixed(2)} zł`;

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
