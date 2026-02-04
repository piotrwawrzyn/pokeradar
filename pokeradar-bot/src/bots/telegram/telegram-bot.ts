/**
 * Telegram bot implementation.
 * Handles incoming commands via long polling.
 */

import TelegramBot from 'node-telegram-bot-api';
import { IBot } from '../../shared/bot.interface';
import { ILogger } from '../../shared/logger';
import { ITelegramCommand } from './commands/command.interface';
import { StartCommand } from './commands/start.command';
import { LinkCommand } from './commands/link.command';
import { HelpCommand } from './commands/help.command';

export class TelegramBotService implements IBot {
  readonly name = 'telegram';
  private bot: TelegramBot;
  private commands: ITelegramCommand[];

  constructor(
    private token: string,
    private appUrl: string,
    private logger: ILogger
  ) {
    this.bot = new TelegramBot(token, { polling: false });

    const startCommand = new StartCommand(this.bot, this.appUrl, this.logger);
    const linkCommand = new LinkCommand(this.bot, this.appUrl, this.logger);

    // All commands excluding help (help needs the full command list)
    const baseCommands: ITelegramCommand[] = [startCommand, linkCommand];

    const helpCommand = new HelpCommand(
      this.bot,
      this.appUrl,
      [...baseCommands, { command: 'help', description: 'Wyświetl dostępne komendy i informacje o bocie' } as ITelegramCommand],
      this.logger
    );

    this.commands = [...baseCommands, helpCommand];
  }

  async start(): Promise<void> {
    this.registerCommands();
    await this.bot.startPolling();
    this.logger.info('Telegram bot started polling');
  }

  async stop(): Promise<void> {
    await this.bot.stopPolling();
    this.logger.info('Telegram bot stopped polling');
  }

  private registerCommands(): void {
    for (const command of this.commands) {
      const pattern = new RegExp(`^\/${command.command}(?:\\s+(.*))?$`);

      this.bot.onText(pattern, async (msg, match) => {
        const args = match?.[1] ?? '';
        this.logger.debug(`Received /${command.command}`, {
          chatId: msg.chat.id,
          args,
        });

        await command.execute(msg, args);
      });
    }
  }
}
