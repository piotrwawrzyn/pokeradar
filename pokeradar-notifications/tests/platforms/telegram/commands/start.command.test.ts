jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue({}),
    onText: jest.fn(),
    startPolling: jest.fn().mockResolvedValue(undefined),
    stopPolling: jest.fn().mockResolvedValue(undefined),
  }));
});

import TelegramBot from 'node-telegram-bot-api';
import { StartCommand } from '../../../../src/platforms/telegram/commands/start.command';

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('StartCommand', () => {
  let command: StartCommand;
  let mockBot: { sendMessage: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    const bot = new TelegramBot('test-token', { polling: false });
    mockBot = bot as unknown as { sendMessage: jest.Mock };
    command = new StartCommand(bot, 'https://pokeradar.app', mockLogger as any);
  });

  it('sends a welcome message with Markdown', async () => {
    const msg = { chat: { id: 12345 } } as TelegramBot.Message;

    await command.execute(msg, '');

    expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockBot.sendMessage).toHaveBeenCalledWith(12345, expect.any(String), {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  });

  it('includes pokeradar link in the welcome message', async () => {
    const msg = { chat: { id: 12345 } } as TelegramBot.Message;

    await command.execute(msg, '');

    const message = mockBot.sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('[pokeradar](https://pokeradar.app)');
    expect(message).toContain('Witaj w pokeradar');
    expect(message).toContain('/link');
    expect(message).toContain('/help');
  });
});
