jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue({}),
    onText: jest.fn(),
    startPolling: jest.fn().mockResolvedValue(undefined),
    stopPolling: jest.fn().mockResolvedValue(undefined),
  }));
});

import TelegramBot from 'node-telegram-bot-api';
import { TelegramBotPlatform } from '../../../src/platforms/telegram/telegram-bot-platform';

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('TelegramBotPlatform', () => {
  let platform: TelegramBotPlatform;
  let mockBot: {
    sendMessage: jest.Mock;
    onText: jest.Mock;
    startPolling: jest.Mock;
    stopPolling: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    platform = new TelegramBotPlatform('test-token', 'https://pokeradar.app', mockLogger as any);
    mockBot = (TelegramBot as unknown as jest.Mock).mock.results[0].value;
  });

  it('has name "telegram"', () => {
    expect(platform.name).toBe('telegram');
  });

  it('starts polling and registers commands on start()', async () => {
    await platform.start();

    expect(mockBot.startPolling).toHaveBeenCalledTimes(1);
    expect(mockBot.onText).toHaveBeenCalled();
  });

  it('stops polling on stop()', async () => {
    await platform.start();
    await platform.stop();

    expect(mockBot.stopPolling).toHaveBeenCalledTimes(1);
  });

  it('returns a notification channel adapter via asNotificationChannel()', () => {
    const channel = platform.asNotificationChannel();

    expect(channel).toBeDefined();
    expect(channel.name).toBe('telegram');
    expect(typeof channel.send).toBe('function');
  });

  it('notification channel adapter uses the same bot instance', async () => {
    const channel = platform.asNotificationChannel();

    await channel.send('chat-123', {
      productName: 'Test Product',
      shopName: 'Test Shop',
      shopId: 'test',
      productId: 'test-1',
      price: 100,
      maxPrice: 120,
      productUrl: 'https://example.com',
    });

    expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      'chat-123',
      expect.any(String),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
  });

  it('registers all three commands (start, link, help)', async () => {
    await platform.start();

    // onText should be called for each command
    expect(mockBot.onText).toHaveBeenCalledTimes(3);

    const patterns = mockBot.onText.mock.calls.map(
      (call: any[]) => call[0].toString()
    );
    expect(patterns.some((p: string) => p.includes('start'))).toBe(true);
    expect(patterns.some((p: string) => p.includes('link'))).toBe(true);
    expect(patterns.some((p: string) => p.includes('help'))).toBe(true);
  });
});
