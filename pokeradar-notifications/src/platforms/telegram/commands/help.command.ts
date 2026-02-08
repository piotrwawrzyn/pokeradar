import TelegramBot from 'node-telegram-bot-api';
import { ITelegramCommand } from './command.interface';
import { ILogger } from '../../../shared/logger';

export class HelpCommand implements ITelegramCommand {
  readonly command = 'help';
  readonly description = 'Wyświetl dostępne komendy i informacje o bocie';

  constructor(
    private bot: TelegramBot,
    private appUrl: string,
    private commands: ITelegramCommand[],
    private logger: ILogger
  ) {}

  async execute(msg: TelegramBot.Message, _args: string): Promise<void> {
    const chatId = msg.chat.id;

    const commandList = this.commands
      .map((cmd) => `/${cmd.command} - ${cmd.description}`)
      .join('\n');

    const message = [
      '*pokeradar Bot*',
      '',
      'Monitoruję ceny produktów Pokemon TCG i powiadamiam, gdy spadną poniżej ustawionego progu.',
      '',
      '*Dostępne komendy:*',
      commandList,
      '',
      'Zarządzaj swoją listą obserwowanych na [pokeradar](' + this.appUrl + ').',
    ].join('\n');

    try {
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
    } catch (error) {
      this.logger.error('Failed to send /help response', { chatId, error });
    }
  }
}
