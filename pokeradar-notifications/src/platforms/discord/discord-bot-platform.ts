/**
 * Discord bot platform.
 * Handles slash command registration/routing and notification delivery via DMs.
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Interaction,
} from 'discord.js';
import { IBotPlatform } from '../bot-platform.interface';
import { INotificationChannel } from '../../notifications/channels/channel.interface';
import { DiscordNotificationAdapter } from './discord-notification-adapter';
import { ILogger } from '../../shared/logger';
import { IDiscordCommand } from './commands/command.interface';
import { DiscordLinkCommand } from './commands/link.command';
import { DiscordHelpCommand } from './commands/help.command';

export class DiscordBotPlatform implements IBotPlatform {
  readonly name = 'discord';
  private client: Client;
  private commands: IDiscordCommand[];
  private channelAdapter: DiscordNotificationAdapter;
  private token: string;

  constructor(
    token: string,
    appUrl: string,
    private logger: ILogger,
  ) {
    this.token = token;
    this.client = new Client({
      intents: [GatewayIntentBits.DirectMessages],
      partials: [Partials.Channel],
    });
    this.channelAdapter = new DiscordNotificationAdapter(this.client);

    const linkCommand = new DiscordLinkCommand(appUrl, this.logger);
    const baseCommands: IDiscordCommand[] = [linkCommand];
    const helpCommand = new DiscordHelpCommand(
      appUrl,
      [
        ...baseCommands,
        {
          command: 'help',
          description: 'Wyświetl dostępne komendy i informacje o bocie',
        } as IDiscordCommand,
      ],
      this.logger,
    );

    this.commands = [...baseCommands, helpCommand];
  }

  async start(): Promise<void> {
    await this.registerSlashCommands();

    this.client.once('clientReady', (readyClient) => {
      this.logger.info('Discord bot ready', { tag: readyClient.user.tag });
    });

    this.client.on('interactionCreate', async (interaction: Interaction) => {
      if (!interaction.isChatInputCommand()) return;
      this.logger.debug('Discord interaction received', {
        command: interaction.commandName,
        userId: interaction.user.id,
      });
      try {
        await this.handleCommand(interaction);
      } catch (error) {
        this.logger.error('Unhandled error in Discord interaction handler', {
          command: interaction.commandName,
          error,
        });
      }
    });

    await this.client.login(this.token);
    this.logger.info('Discord bot platform started');
  }

  async stop(): Promise<void> {
    this.client.destroy();
    this.logger.info('Discord bot platform stopped');
  }

  asNotificationChannel(): INotificationChannel {
    return this.channelAdapter;
  }

  private async registerSlashCommands(): Promise<void> {
    const rest = new REST().setToken(this.token);

    const slashCommands = this.commands.map((cmd) => {
      const builder = new SlashCommandBuilder()
        .setName(cmd.command)
        .setDescription(cmd.description);

      // The /link command needs a token option
      if (cmd.command === 'link') {
        builder.addStringOption((option) =>
          option.setName('token').setDescription('Token połączenia z pokeradar').setRequired(true),
        );
      }

      return builder.toJSON();
    });

    const clientId = this.client.application?.id ?? (await this.fetchClientId(rest));

    await rest.put(Routes.applicationCommands(clientId), { body: slashCommands });
    this.logger.info('Discord slash commands registered', { count: slashCommands.length });
  }

  private async fetchClientId(rest: REST): Promise<string> {
    // Fetch bot user to get the client ID before client.application is populated
    const data = (await rest.get(Routes.user('@me'))) as { id: string };
    return data.id;
  }

  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands.find((cmd) => cmd.command === interaction.commandName);
    if (!command) return;

    this.logger.debug(`Received /${interaction.commandName}`, { userId: interaction.user.id });
    await command.execute(interaction);
  }
}
