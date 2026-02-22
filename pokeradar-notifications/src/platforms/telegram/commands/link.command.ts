import TelegramBot from 'node-telegram-bot-api';
import { UserModel } from '@pokeradar/shared';
import { ITelegramCommand } from './command.interface';
import { ILogger } from '../../../shared/logger';
import { getTelegramMessages, botError } from '../../../messages/notification.messages';

export class LinkCommand implements ITelegramCommand {
  readonly command = 'link';
  readonly description = 'Połącz konto Telegram za pomocą tokenu ze strony';

  constructor(
    private bot: TelegramBot,
    private appUrl: string,
    private logger: ILogger,
  ) {}

  async execute(msg: TelegramBot.Message, args: string): Promise<void> {
    const chatId = msg.chat.id;
    const token = args.trim();
    const messages = getTelegramMessages(this.appUrl);

    if (!token) {
      try {
        await this.bot.sendMessage(chatId, messages.linkUsage, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        });
      } catch (error) {
        this.logger.error('Failed to send /link usage response', { chatId, error });
      }
      return;
    }

    try {
      const alreadyLinked = await UserModel.exists({ 'telegram.channelId': chatId.toString() });
      if (alreadyLinked) {
        await this.bot.sendMessage(chatId, messages.linkAlreadyLinked, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        });
        return;
      }

      const user = await UserModel.findOneAndUpdate(
        { 'telegram.linkToken': token },
        {
          $set: { 'telegram.channelId': chatId.toString() },
          $unset: { 'telegram.linkToken': '' },
        },
        { new: true },
      );

      if (!user) {
        await this.bot.sendMessage(chatId, messages.linkInvalidToken, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        });
        return;
      }

      this.logger.info('Telegram account linked', {
        userId: user._id.toString(),
        chatId,
      });

      await this.bot.sendMessage(chatId, messages.linkSuccess, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });
    } catch (error) {
      this.logger.error('Failed to process /link command', { chatId, token, error });

      try {
        await this.bot.sendMessage(
          chatId,
          botError('Coś poszło nie tak. Spróbuj ponownie później.'),
        );
      } catch {
        // Nothing we can do if sending the error message also fails
      }
    }
  }
}
