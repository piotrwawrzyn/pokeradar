import { ChangeStreamWatcher } from '../../src/services/change-stream-watcher';
import { NotificationModel } from '../../src/infrastructure/database';
import { ILogger } from '../../src/shared/logger';
import { INotificationPayload } from '../../src/shared/types';

const mockLogger: ILogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockPayload: INotificationPayload = {
  productName: 'Pokemon 151 Booster Box',
  shopName: 'Rebel.pl',
  shopId: 'rebel',
  productId: 'pokemon-151-booster-box',
  price: 149.99,
  maxPrice: 160.0,
  productUrl: 'https://rebel.pl/product/pokemon-151',
};

describe('ChangeStreamWatcher', () => {
  let watcher: ChangeStreamWatcher;

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
    }
  });

  it('detects newly inserted notifications', async () => {
    const receivedDocs: any[] = [];
    watcher = new ChangeStreamWatcher(mockLogger);

    watcher.start((doc) => {
      receivedDocs.push(doc);
    });

    // Give the change stream a moment to initialize
    await new Promise((resolve) => setTimeout(resolve, 500));

    await NotificationModel.create({
      userId: 'user-1',
      channel: 'telegram',
      channelTarget: 'chat-123',
      status: 'pending',
      payload: mockPayload,
      attempts: 0,
      error: null,
      sentAt: null,
    });

    // Wait for the change event to propagate
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(receivedDocs.length).toBe(1);
    expect(receivedDocs[0].userId).toBe('user-1');
    expect(receivedDocs[0].channel).toBe('telegram');
    expect(receivedDocs[0].payload.productName).toBe('Pokemon 151 Booster Box');
  });

  it('stops receiving events after stop()', async () => {
    const receivedDocs: any[] = [];
    watcher = new ChangeStreamWatcher(mockLogger);

    watcher.start((doc) => {
      receivedDocs.push(doc);
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    await watcher.stop();

    await NotificationModel.create({
      userId: 'user-2',
      channel: 'telegram',
      channelTarget: 'chat-456',
      status: 'pending',
      payload: mockPayload,
      attempts: 0,
      error: null,
      sentAt: null,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(receivedDocs.length).toBe(0);
  });
});
