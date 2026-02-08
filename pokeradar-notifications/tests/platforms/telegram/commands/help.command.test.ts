jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue({}),
    onText: jest.fn(),
    startPolling: jest.fn().mockResolvedValue(undefined),
    stopPolling: jest.fn().mockResolvedValue(undefined),
  }));
});

import TelegramBot from 'node-telegram-bot-api';
import { HelpCommand } from '../../../../src/platforms/telegram/commands/help.command';
import { ITelegramCommand } from '../../../../src/platforms/telegram/commands/command.interface';

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('HelpCommand', () => {
  let command: HelpCommand;
  let mockBot: { sendMessage: jest.Mock };

  const fakeCommands: ITelegramCommand[] = [
    { command: 'start', description: 'Uruchom bota', execute: jest.fn() },
    { command: 'link', description: 'Połącz konto', execute: jest.fn() },
    { command: 'help', description: 'Pomoc', execute: jest.fn() },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    const bot = new TelegramBot('test-token', { polling: false });
    mockBot = bot as unknown as { sendMessage: jest.Mock };
    command = new HelpCommand(bot, 'https://pokeradar.app', fakeCommands, mockLogger as any);
  });

  it('sends a help message listing all commands', async () => {
    const msg = { chat: { id: 12345 } } as TelegramBot.Message;

    await command.execute(msg, '');

    expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
    const message = mockBot.sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('/start - Uruchom bota');
    expect(message).toContain('/link - Połącz konto');
    expect(message).toContain('/help - Pomoc');
    expect(message).toContain('[pokeradar](https://pokeradar.app)');
  });

  it('uses Markdown parse mode', async () => {
    const msg = { chat: { id: 12345 } } as TelegramBot.Message;

    await command.execute(msg, '');

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      12345,
      expect.any(String),
      { parse_mode: 'Markdown', disable_web_page_preview: true }
    );
  });
});
