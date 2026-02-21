import TelegramBot from 'node-telegram-bot-api';
import { ITelegramCommand } from './command.interface';
import { ILogger } from '../../../shared/logger';
import { getTelegramMessages } from '../../../messages/notification.messages';

export class StartCommand implements ITelegramCommand {
  readonly command = 'start';
  readonly description = 'Uruchom bota i zobacz wiadomość powitalną';

  constructor(
    private bot: TelegramBot,
    private appUrl: string,
    private logger: ILogger
  ) {}

  async execute(msg: TelegramBot.Message, _args: string): Promise<void> {
    const chatId = msg.chat.id;
    const messages = getTelegramMessages(this.appUrl);

    try {
      await this.bot.sendMessage(chatId, messages.start, { parse_mode: 'Markdown', disable_web_page_preview: true });
    } catch (error) {
      this.logger.error('Failed to send /start response', { chatId, error });
    }
  }
}
