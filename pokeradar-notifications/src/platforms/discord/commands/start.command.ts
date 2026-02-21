import { ChatInputCommandInteraction } from 'discord.js';
import { IDiscordCommand } from './command.interface';
import { ILogger } from '../../../shared/logger';
import { getDiscordMessages } from '../../../messages/notification.messages';

export class DiscordStartCommand implements IDiscordCommand {
  readonly command = 'start';
  readonly description = 'Uruchom bota i zobacz wiadomość powitalną';

  constructor(
    private appUrl: string,
    private logger: ILogger
  ) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const messages = getDiscordMessages(this.appUrl);
    try {
      await interaction.reply({ content: messages.start, ephemeral: true });
    } catch (error) {
      this.logger.error('Failed to send /start response', { userId: interaction.user.id, error });
    }
  }
}
