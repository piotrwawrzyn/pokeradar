/**
 * Telegram notification channel adapter.
 * Implements INotificationChannel using a shared TelegramBot instance.
 */

import TelegramBot from 'node-telegram-bot-api';
import { INotificationChannel } from '../../notifications/channels/channel.interface';
import { INotificationPayload } from '@pokeradar/shared';
import { formatTelegramNotification } from '../../messages/notification.messages';

export class TelegramNotificationAdapter implements INotificationChannel {
  readonly name = 'telegram';

  constructor(private bot: TelegramBot) {}

  async send(target: string, payload: INotificationPayload): Promise<void> {
    await this.bot.sendMessage(target, formatTelegramNotification(payload), {
      parse_mode: 'Markdown',
      // Show a compact (small) link preview instead of a large one
      link_preview_options: { prefer_small_media: true },
    } as Parameters<TelegramBot['sendMessage']>[2]);
  }
}
