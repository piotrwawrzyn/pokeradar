import { ChatInputCommandInteraction } from 'discord.js';
import { UserModel } from '@pokeradar/shared';
import { IDiscordCommand } from './command.interface';
import { ILogger } from '../../../shared/logger';
import { getDiscordMessages, botError } from '../../../messages/notification.messages';

export class DiscordLinkCommand implements IDiscordCommand {
  readonly command = 'link';
  readonly description = 'Połącz Discord z pokeradar';

  constructor(
    private appUrl: string,
    private logger: ILogger,
  ) {}

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: number }).code === 11000
    );
  }

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
      const existingUser = await UserModel.findOne(
        { 'discord.channelId': interaction.user.id },
        { 'discord.linkToken': 1 },
      ).lean();

      if (existingUser) {
        // Check if this Discord ID is linked to the same user who owns the token
        const tokenOwner = await UserModel.exists({ 'discord.linkToken': token });
        const isSameUser = tokenOwner && existingUser._id.toString() === tokenOwner._id.toString();

        await interaction.reply({
          content: isSameUser ? messages.linkAlreadyLinked : messages.linkUsedByAnother,
          ephemeral: true,
        });
        return;
      }

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
      // Race condition safety net: unique index prevents duplicate channelId
      if (this.isDuplicateKeyError(error)) {
        await interaction.reply({ content: messages.linkUsedByAnother, ephemeral: true });
        return;
      }

      this.logger.error('Failed to process /link command', {
        userId: interaction.user.id,
        token,
        error,
      });

      try {
        await interaction.reply({
          content: botError('Coś poszło nie tak. Spróbuj ponownie później.'),
          ephemeral: true,
        });
      } catch {
        // Nothing we can do if sending the error message also fails
      }
    }
  }
}
