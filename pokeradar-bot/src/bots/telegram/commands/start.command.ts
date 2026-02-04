import TelegramBot from 'node-telegram-bot-api';
import { ITelegramCommand } from './command.interface';
import { ILogger } from '../../../shared/logger';

export class StartCommand implements ITelegramCommand {
  readonly command = 'start';
  readonly description = 'Uruchom bota i zobacz wiadomosc powitalną';

  constructor(
    private bot: TelegramBot,
    private appUrl: string,
    private logger: ILogger
  ) {}

  async execute(msg: TelegramBot.Message, _args: string): Promise<void> {
    const chatId = msg.chat.id;

    const message = [
      '*Witaj w pokeradar!*',
      '',
      'Monitoruję ceny produktów Pokemon TCG i wysyłam powiadomienia, gdy cena spadnie poniżej ustawionego progu.',
      '',
      'Aby zacząć, połącz swoje konto za pomocą tokenu ze strony:',
      '1. Wejdź na [pokeradar](' + this.appUrl + ') i otwórz Ustawienia',
      '2. Wygeneruj token połączenia',
      '3. Wyślij go tutaj: `/link <token>`',
      '',
      'Użyj /help, aby zobaczyć dostępne komendy.',
    ].join('\n');

    try {
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
    } catch (error) {
      this.logger.error('Failed to send /start response', { chatId, error });
    }
  }
}
