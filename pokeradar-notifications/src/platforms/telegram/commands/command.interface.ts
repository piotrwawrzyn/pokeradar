/**
 * Telegram command interface.
 * Implement this for each bot command (/start, /link, /help, etc.).
 */

import TelegramBot from 'node-telegram-bot-api';

export interface ITelegramCommand {
  readonly command: string;
  readonly description: string;
  execute(msg: TelegramBot.Message, args: string): Promise<void>;
}
