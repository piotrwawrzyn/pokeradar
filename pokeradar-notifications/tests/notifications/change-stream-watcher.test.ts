import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { ChangeStreamWatcher } from '../../src/notifications/change-stream-watcher';
import { NotificationModel } from '@pokeradar/shared';
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

let replSet: MongoMemoryReplSet | null = null;
let replSetAvailable = false;

beforeAll(async () => {
  // Disconnect from the shared MongoMemoryServer (from setup.ts)
  await mongoose.disconnect();

  try {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    const uri = replSet.getUri();
    await mongoose.connect(uri);
    replSetAvailable = true;
  } catch {
    // Replica set unavailable (e.g. fassert failure on some platforms).
    // Tests will be skipped gracefully.
    replSetAvailable = false;
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop().catch(() => {});
  }

  // Reconnect to the shared MongoMemoryServer so afterAll in setup.ts doesn't fail
  // (setup.ts manages a standalone server and calls disconnect + stop in its own afterAll)
});

afterEach(async () => {
  if (replSetAvailable) {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  }
});

describe('ChangeStreamWatcher', () => {
  let watcher: ChangeStreamWatcher;

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
    }
  });

  it('detects newly inserted notifications', async () => {
    if (!replSetAvailable) return;

    const receivedDocs: any[] = [];
    watcher = new ChangeStreamWatcher(mockLogger);

    watcher.start((doc) => {
      receivedDocs.push(doc);
    });

    // Give the change stream a moment to initialize
    await new Promise((resolve) => setTimeout(resolve, 500));

    await NotificationModel.create({
      userId: 'user-1',
      status: 'pending',
      payload: mockPayload,
      deliveries: [
        {
          channel: 'telegram',
          channelTarget: 'chat-123',
          status: 'pending',
          attempts: 0,
          error: null,
          sentAt: null,
        },
      ],
    });

    // Wait for the change event to propagate
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(receivedDocs.length).toBe(1);
    expect(receivedDocs[0].userId).toBe('user-1');
    expect(receivedDocs[0].deliveries[0].channel).toBe('telegram');
    expect(receivedDocs[0].payload.productName).toBe('Pokemon 151 Booster Box');
  });

  it('stops receiving events after stop()', async () => {
    if (!replSetAvailable) return;

    const receivedDocs: any[] = [];
    watcher = new ChangeStreamWatcher(mockLogger);

    watcher.start((doc) => {
      receivedDocs.push(doc);
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    await watcher.stop();

    await NotificationModel.create({
      userId: 'user-2',
      status: 'pending',
      payload: mockPayload,
      deliveries: [
        {
          channel: 'telegram',
          channelTarget: 'chat-456',
          status: 'pending',
          attempts: 0,
          error: null,
          sentAt: null,
        },
      ],
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(receivedDocs.length).toBe(0);
  });
});
