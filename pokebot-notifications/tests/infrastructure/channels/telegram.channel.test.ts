import { TelegramChannel } from '../../../src/infrastructure/channels/telegram.channel';
import { INotificationPayload } from '../../../src/shared/types';

// Mock node-telegram-bot-api
jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue({}),
  }));
});

import TelegramBot from 'node-telegram-bot-api';

describe('TelegramChannel', () => {
  const mockPayload: INotificationPayload = {
    productName: 'Pokemon 151 Booster Box',
    shopName: 'Rebel.pl',
    shopId: 'rebel',
    productId: 'pokemon-151-booster-box',
    price: 149.99,
    maxPrice: 160.0,
    productUrl: 'https://rebel.pl/product/pokemon-151',
  };

  let channel: TelegramChannel;
  let mockBot: { sendMessage: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    channel = new TelegramChannel('test-token');
    mockBot = (TelegramBot as unknown as jest.Mock).mock.results[0].value;
  });

  it('has name "telegram"', () => {
    expect(channel.name).toBe('telegram');
  });

  it('creates bot with polling disabled', () => {
    expect(TelegramBot).toHaveBeenCalledWith('test-token', { polling: false });
  });

  it('sends a formatted message to the target chat', async () => {
    await channel.send('chat-123', mockPayload);

    expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      'chat-123',
      expect.any(String),
      { parse_mode: 'Markdown', disable_web_page_preview: false }
    );
  });

  it('formats the message in Polish', async () => {
    await channel.send('chat-123', mockPayload);

    const message = mockBot.sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('Produkt dostępny!');
    expect(message).toContain('Pokemon 151 Booster Box');
    expect(message).toContain('Sklep: Rebel.pl');
    expect(message).toContain('149.99 zł');
    expect(message).toContain('160.00 zł');
    expect(message).toContain('[Zobacz produkt](https://rebel.pl/product/pokemon-151)');
  });

  it('propagates errors from the Telegram API', async () => {
    mockBot.sendMessage.mockRejectedValueOnce(new Error('Telegram API error'));

    await expect(channel.send('chat-123', mockPayload)).rejects.toThrow('Telegram API error');
  });
});
