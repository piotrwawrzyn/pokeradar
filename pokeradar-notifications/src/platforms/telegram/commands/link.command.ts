import TelegramBot from 'node-telegram-bot-api';
import { UserModel } from '@pokeradar/shared';
import { ITelegramCommand } from './command.interface';
import { ILogger } from '../../../shared/logger';
import { getTelegramMessages, botError } from '../../../messages/notification.messages';

export class LinkCommand implements ITelegramCommand {
  readonly command = 'link';
  readonly description = 'Połącz Telegram z pokeradar';

  private static readonly AWAIT_TTL_MS = 10 * 60 * 1000; // 10 minutes

  // Chat IDs that sent /link without a token, mapped to their expiry timer
  private awaitingToken = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(
    private bot: TelegramBot,
    private appUrl: string,
    private logger: ILogger,
  ) {
    // Intercept the next plain-text message from any chat that is awaiting a token
    this.bot.on('message', async (msg) => {
      if (!msg.text || msg.text.startsWith('/')) return;
      const chatId = msg.chat.id;
      if (!this.awaitingToken.has(chatId)) return;
      this.clearPending(chatId);

      await this.processToken(chatId, msg.text.trim());
    });
  }

  private async replyAlreadyLinkedIfNeeded(chatId: number): Promise<boolean> {
    const messages = getTelegramMessages(this.appUrl);
    const alreadyLinked = await UserModel.exists({ 'telegram.channelId': chatId.toString() });
    if (alreadyLinked) {
      await this.bot.sendMessage(chatId, messages.linkAlreadyLinked, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });
      return true;
    }
    return false;
  }

  private clearPending(chatId: number): void {
    const timer = this.awaitingToken.get(chatId);
    if (timer !== undefined) clearTimeout(timer);
    this.awaitingToken.delete(chatId);
  }

  async execute(msg: TelegramBot.Message, args: string): Promise<void> {
    const chatId = msg.chat.id;
    const token = args.trim();

    if (!token) {
      try {
        const messages = getTelegramMessages(this.appUrl);

        if (await this.replyAlreadyLinkedIfNeeded(chatId)) return;

        await this.bot.sendMessage(chatId, messages.linkPrompt, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: {
            force_reply: true,
            selective: true,
            input_field_placeholder: 'Wklej token tutaj…',
          },
        } as Parameters<TelegramBot['sendMessage']>[2]);

        // Cancel any previous pending prompt for this chat before setting a new one
        this.clearPending(chatId);
        const timer = setTimeout(() => {
          this.awaitingToken.delete(chatId);
          this.logger.debug('Expired /link token prompt', { chatId });
        }, LinkCommand.AWAIT_TTL_MS);
        this.awaitingToken.set(chatId, timer);
      } catch (error) {
        this.logger.error('Failed to send /link usage response', { chatId, error });
      }
      return;
    }

    await this.processToken(chatId, token);
  }

  private async processToken(chatId: number, token: string): Promise<void> {
    const messages = getTelegramMessages(this.appUrl);

    try {
      if (await this.replyAlreadyLinkedIfNeeded(chatId)) return;

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
