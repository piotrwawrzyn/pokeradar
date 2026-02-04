/**
 * Telegram notification channel.
 * Sends formatted product alerts via Telegram Bot API.
 */

import TelegramBot from 'node-telegram-bot-api';
import { INotificationChannel } from './channel.interface';
import { INotificationPayload } from '../../shared/types';

export class TelegramChannel implements INotificationChannel {
  readonly name = 'telegram';
  private bot: TelegramBot;

  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: false });
  }

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
