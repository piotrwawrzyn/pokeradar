jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue({}),
    onText: jest.fn(),
    startPolling: jest.fn().mockResolvedValue(undefined),
    stopPolling: jest.fn().mockResolvedValue(undefined),
  }));
});

import TelegramBot from 'node-telegram-bot-api';
import { UserModel } from '@pokeradar/shared';
import { LinkCommand } from '../../../../src/platforms/telegram/commands/link.command';

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('LinkCommand', () => {
  let command: LinkCommand;
  let mockBot: { sendMessage: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    const bot = new TelegramBot('test-token', { polling: false });
    mockBot = bot as unknown as { sendMessage: jest.Mock };
    command = new LinkCommand(bot, 'https://pokeradar.app', mockLogger as any);
  });

  it('links account when a valid token is provided', async () => {
    const user = await UserModel.create({
      googleId: 'google-123',
      email: 'test@example.com',
      displayName: 'Test User',
      telegram: { channelId: null, linkToken: 'valid-token-123' },
    });

    const msg = { chat: { id: 99999 } } as TelegramBot.Message;
    await command.execute(msg, 'valid-token-123');

    // Verify user was updated
    const updatedUser = await UserModel.findById(user._id);
    expect(updatedUser?.telegram.channelId).toBe('99999');
    expect(updatedUser?.telegram.linkToken).toBeNull();

    // Verify success message
    expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
    const message = mockBot.sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('Konto połączone');
    expect(message).toContain('[pokeradar](https://pokeradar.app)');
  });

  it('sends error when an invalid token is provided', async () => {
    const msg = { chat: { id: 99999 } } as TelegramBot.Message;
    await command.execute(msg, 'bad-token');

    expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
    const message = mockBot.sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('Nieprawidłowy lub wygasły token');
    expect(message).toContain('[pokeradar](https://pokeradar.app)');
  });

  it('sends usage hint when no token argument is provided', async () => {
    const msg = { chat: { id: 99999 } } as TelegramBot.Message;
    await command.execute(msg, '');

    expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
    const message = mockBot.sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('Podaj token');
    expect(message).toContain('/link <token>');
  });

  it('overwrites existing telegram.channelId when relinking with a new token', async () => {
    const user = await UserModel.create({
      googleId: 'google-456',
      email: 'relink@example.com',
      displayName: 'Relink User',
      telegram: { channelId: '11111', linkToken: 'new-token-456' },
    });

    const msg = { chat: { id: 22222 } } as TelegramBot.Message;
    await command.execute(msg, 'new-token-456');

    const updatedUser = await UserModel.findById(user._id);
    expect(updatedUser?.telegram.channelId).toBe('22222');
    expect(updatedUser?.telegram.linkToken).toBeNull();

    const message = mockBot.sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('Konto połączone');
  });

  it('informs user when chat is already linked without a token', async () => {
    await UserModel.create({
      googleId: 'google-linked',
      email: 'linked@example.com',
      displayName: 'Linked User',
      telegram: { channelId: '99999', linkToken: null },
    });

    const msg = { chat: { id: 99999 } } as TelegramBot.Message;
    await command.execute(msg, 'nonexistent-token');

    const message = mockBot.sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('Nieprawidłowy lub wygasły token');
  });

  it('handles sendMessage failure gracefully', async () => {
    await UserModel.create({
      googleId: 'google-789',
      email: 'error@example.com',
      displayName: 'Error User',
      telegram: { channelId: null, linkToken: 'error-token' },
    });

    mockBot.sendMessage.mockRejectedValueOnce(new Error('Telegram API error'));

    const msg = { chat: { id: 33333 } } as TelegramBot.Message;

    // Should not throw
    await expect(command.execute(msg, 'error-token')).resolves.not.toThrow();
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
