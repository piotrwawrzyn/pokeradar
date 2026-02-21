import { ChatInputCommandInteraction } from 'discord.js';
import { UserModel } from '@pokeradar/shared';
import { IDiscordCommand } from './command.interface';
import { ILogger } from '../../../shared/logger';
import { getDiscordMessages } from '../../../messages/notification.messages';

export class DiscordLinkCommand implements IDiscordCommand {
  readonly command = 'link';
  readonly description = 'Połącz konto Discord za pomocą tokenu ze strony';

  constructor(
    private appUrl: string,
    private logger: ILogger,
  ) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const messages = getDiscordMessages(this.appUrl);
    const token = interaction.options.getString('token');

    if (!token) {
      try {
        await interaction.reply({ content: messages.linkUsage, ephemeral: true });
      } catch (error) {
        this.logger.error('Failed to send /link usage response', {
          userId: interaction.user.id,
          error,
        });
      }
      return;
    }

    try {
      const user = await UserModel.findOneAndUpdate(
        { 'discord.linkToken': token },
        {
          $set: { 'discord.channelId': interaction.user.id },
          $unset: { 'discord.linkToken': '' },
        },
        { new: true },
      );

      if (!user) {
        await interaction.reply({ content: messages.linkInvalidToken, ephemeral: true });
        return;
      }

      this.logger.info('Discord account linked', {
        userId: user._id.toString(),
        discordUserId: interaction.user.id,
      });

      await interaction.reply({ content: messages.linkSuccess, ephemeral: true });
    } catch (error) {
      this.logger.error('Failed to process /link command', {
        userId: interaction.user.id,
        token,
        error,
      });

      try {
        await interaction.reply({
          content: 'Coś poszło nie tak. Spróbuj ponownie później.',
          ephemeral: true,
        });
      } catch {
        // Nothing we can do if sending the error message also fails
      }
    }
  }
}
