import TelegramBot from 'node-telegram-bot-api';
import { ITelegramCommand } from './command.interface';
import { ILogger } from '@pokeradar/shared';
import { getTelegramMessages } from '../../../messages/notification.messages';

export class HelpCommand implements ITelegramCommand {
  readonly command = 'help';
  readonly description = 'Wyświetl informacje o bocie';

  constructor(
    private bot: TelegramBot,
    private appUrl: string,
    private commands: ITelegramCommand[],
    private logger: ILogger,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(msg: TelegramBot.Message, _args: string): Promise<void> {
    const chatId = msg.chat.id;
    const botMessages = getTelegramMessages(this.appUrl);
    const commandList = this.commands
      .filter((cmd) => cmd.command !== 'help')
      .map((cmd) => `/${cmd.command} - ${cmd.description}`)
      .join('\n');

    try {
      await this.bot.sendMessage(chatId, botMessages.help(commandList), {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });
    } catch (error) {
      this.logger.error('Failed to send /help response', { chatId, error });
    }
  }
}
