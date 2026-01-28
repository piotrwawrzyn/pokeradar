/**
 * Telegram bot client setup and configuration.
 */

import TelegramBot from 'node-telegram-bot-api';

/**
 * Telegram client options.
 */
export interface TelegramClientOptions {
  token: string;
  chatId: string;
  polling?: boolean;
}

/**
 * Creates a configured Telegram bot instance.
 */
export function createTelegramBot(token: string, polling: boolean = false): TelegramBot {
  return new TelegramBot(token, { polling });
}

/**
 * Sends a message via Telegram bot.
 */
export async function sendTelegramMessage(
  bot: TelegramBot,
  chatId: string,
  message: string,
  options?: {
    parseMode?: 'Markdown' | 'HTML';
    disableWebPagePreview?: boolean;
  }
): Promise<void> {
  await bot.sendMessage(chatId, message, {
    parse_mode: options?.parseMode ?? 'Markdown',
    disable_web_page_preview: options?.disableWebPagePreview ?? true,
  });
}

/**
 * Validates Telegram configuration.
 * Throws an error if required values are missing.
 */
export function validateTelegramConfig(token?: string, chatId?: string): void {
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID is not set');
  }
}
