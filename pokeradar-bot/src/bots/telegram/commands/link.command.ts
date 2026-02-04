import TelegramBot from 'node-telegram-bot-api';
import { UserModel } from '@pokeradar/shared';
import { ITelegramCommand } from './command.interface';
import { ILogger } from '../../../shared/logger';

export class LinkCommand implements ITelegramCommand {
  readonly command = 'link';
  readonly description = 'Połącz konto Telegram za pomocą tokenu ze strony';

  constructor(
    private bot: TelegramBot,
    private appUrl: string,
    private logger: ILogger
  ) {}

  async execute(msg: TelegramBot.Message, args: string): Promise<void> {
    const chatId = msg.chat.id;
    const token = args.trim();

    if (!token) {
      try {
        await this.bot.sendMessage(
          chatId,
          'Podaj token. Użycie: `/link <token>`\n\nWygeneruj go na [pokeradar](' + this.appUrl + ').',
          { parse_mode: 'Markdown', disable_web_page_preview: true }
        );
      } catch (error) {
        this.logger.error('Failed to send /link usage response', { chatId, error });
      }
      return;
    }

    try {
      const user = await UserModel.findOneAndUpdate(
        { telegramLinkToken: token },
        {
          $set: { telegramChatId: chatId.toString() },
          $unset: { telegramLinkToken: '' },
        },
        { new: true }
      );

      if (!user) {
        await this.bot.sendMessage(
          chatId,
          'Nieprawidłowy lub wygasły token. Wygeneruj nowy na [pokeradar](' + this.appUrl + ').',
          { parse_mode: 'Markdown', disable_web_page_preview: true }
        );
        return;
      }

      this.logger.info('Telegram account linked', {
        userId: user._id.toString(),
        chatId,
      });

      await this.bot.sendMessage(
        chatId,
        'Konto połączone! Od teraz będziesz otrzymywać powiadomienia o cenach.\n\nWróć na [pokeradar](' + this.appUrl + '), aby dostosować swoją listę obserwowanych.',
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    } catch (error) {
      this.logger.error('Failed to process /link command', { chatId, token, error });

      try {
        await this.bot.sendMessage(
          chatId,
          'Coś poszło nie tak. Spróbuj ponownie później.',
        );
      } catch {
        // Nothing we can do if sending the error message also fails
      }
    }
  }
}
