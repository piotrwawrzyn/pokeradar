import { ChatInputCommandInteraction } from 'discord.js';
import { IDiscordCommand } from './command.interface';
import { ILogger } from '../../../shared/logger';
import { getDiscordMessages } from '../../../messages/notification.messages';

export class DiscordHelpCommand implements IDiscordCommand {
  readonly command = 'help';
  readonly description = 'Wyświetl dostępne komendy i informacje o bocie';

  constructor(
    private appUrl: string,
    private commands: IDiscordCommand[],
    private logger: ILogger,
  ) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const messages = getDiscordMessages(this.appUrl);
    const commandList = this.commands
      .map((cmd) => `**/${cmd.command}** — ${cmd.description}`)
      .join('\n');

    try {
      await interaction.reply({ content: messages.help(commandList), ephemeral: true });
    } catch (error) {
      this.logger.error('Failed to send /help response', { userId: interaction.user.id, error });
    }
  }
}
