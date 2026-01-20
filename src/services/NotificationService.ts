import TelegramBot from 'node-telegram-bot-api';
import { WatchlistProduct, ProductResult, ShopConfig } from '../types';
import { Logger } from './Logger';

export class NotificationService {
  private bot: TelegramBot;
  private chatId: string;
  private logger: Logger;

  constructor(token: string, chatId: string, logger?: Logger) {
    this.bot = new TelegramBot(token, { polling: false });
    this.chatId = chatId;
    this.logger = logger || new Logger();
  }

  /**
   * Sends a Telegram alert when a product meets criteria.
   */
  async sendAlert(
    product: WatchlistProduct,
    result: ProductResult,
    shop: ShopConfig
  ): Promise<void> {
    try {
      const message = this.formatMessage(product, result, shop);

      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });

      this.logger.info('Telegram notification sent', {
        product: product.id,
        shop: shop.id,
        price: result.price
      });
    } catch (error) {
      this.logger.error('Failed to send Telegram notification', {
        product: product.id,
        shop: shop.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Formats the notification message.
   */
  private formatMessage(
    product: WatchlistProduct,
    result: ProductResult,
    shop: ShopConfig
  ): string {
    const priceStr = result.price !== null
      ? `${result.price.toFixed(2)} zł`
      : 'N/A';
    const maxPriceStr = `${product.maxPrice.toFixed(2)} zł`;
    const productName = result.productTitle || product.name || product.searchPhrases[0];

    return `
🎯 *Product Available!*

📦 ${productName}
🏪 Shop: ${shop.name}
💰 Price: ${priceStr} (max: ${maxPriceStr})
✅ Status: Available

🔗 [View Product](${result.productUrl})
    `.trim();
  }

  /**
   * Sends a test notification to verify the setup.
   */
  async sendTestNotification(): Promise<void> {
    try {
      await this.bot.sendMessage(
        this.chatId,
        '🤖 Pokemon Price Monitor is now running!'
      );
      this.logger.info('Test notification sent successfully');
    } catch (error) {
      this.logger.error('Failed to send test notification', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
