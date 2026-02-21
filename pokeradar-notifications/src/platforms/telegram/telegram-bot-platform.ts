/**
 * Telegram bot platform.
 * Single TelegramBot instance that handles both interactive commands
 * (polling) and notification delivery (via adapter).
 */

import TelegramBot from 'node-telegram-bot-api';
import { IBotPlatform } from '../bot-platform.interface';
import { INotificationChannel } from '../../notifications/channels/channel.interface';
import { TelegramNotificationAdapter } from './telegram-notification-adapter';
import { ILogger } from '../../shared/logger';
import { ITelegramCommand } from './commands/command.interface';
import { StartCommand } from './commands/start.command';
import { LinkCommand } from './commands/link.command';
import { HelpCommand } from './commands/help.command';

export class TelegramBotPlatform implements IBotPlatform {
  readonly name = 'telegram';
  private bot: TelegramBot;
  private commands: ITelegramCommand[];
  private channelAdapter: TelegramNotificationAdapter;

  constructor(
    token: string,
    appUrl: string,
    private logger: ILogger,
  ) {
    this.bot = new TelegramBot(token, { polling: false });
    this.channelAdapter = new TelegramNotificationAdapter(this.bot);

    const startCommand = new StartCommand(this.bot, appUrl, this.logger);
    const linkCommand = new LinkCommand(this.bot, appUrl, this.logger);

    const baseCommands: ITelegramCommand[] = [startCommand, linkCommand];

    const helpCommand = new HelpCommand(
      this.bot,
      appUrl,
      [
        ...baseCommands,
        {
          command: 'help',
          description: 'Wyświetl dostępne komendy i informacje o bocie',
        } as ITelegramCommand,
      ],
      this.logger,
    );

    this.commands = [...baseCommands, helpCommand];
  }

  async start(): Promise<void> {
    this.registerCommands();
    await this.setMenuCommands();
    await this.bot.startPolling();
    this.logger.info('Telegram bot platform started (polling + notifications)');
  }

  async stop(): Promise<void> {
    await this.bot.stopPolling();
    this.logger.info('Telegram bot platform stopped');
  }

  asNotificationChannel(): INotificationChannel {
    return this.channelAdapter;
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

  private async setMenuCommands(): Promise<void> {
    try {
      await this.bot.setMyCommands(
        this.commands.map((cmd) => ({ command: cmd.command, description: cmd.description })),
      );
      this.logger.info('Telegram bot commands registered', { count: this.commands.length });
    } catch (error) {
      this.logger.error('Failed to register Telegram bot commands', { error });
    }
  }
}
