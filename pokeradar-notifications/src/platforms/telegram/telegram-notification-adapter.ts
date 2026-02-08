/**
 * Telegram notification channel adapter.
 * Implements INotificationChannel using a shared TelegramBot instance.
 */

import TelegramBot from 'node-telegram-bot-api';
import { INotificationChannel } from '../../notifications/channels/channel.interface';
import { INotificationPayload } from '../../shared/types';

export class TelegramNotificationAdapter implements INotificationChannel {
  readonly name = 'telegram';

  constructor(private bot: TelegramBot) {}

  async send(target: string, payload: INotificationPayload): Promise<void> {
    const message = this.formatMessage(payload);

    await this.bot.sendMessage(target, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
    });
  }

  private formatMessage(payload: INotificationPayload): string {
    const priceStr = `${payload.price.toFixed(2)} zł`;
    const maxPriceStr = `${payload.maxPrice.toFixed(2)} zł`;

    return `
🎯 *Produkt dostępny!*

📦 ${payload.productName}
🏪 Sklep: ${payload.shopName}
💰 Cena: ${priceStr} (maks: ${maxPriceStr})

🔗 [Zobacz produkt](${payload.productUrl})
    `.trim();
  }
}
