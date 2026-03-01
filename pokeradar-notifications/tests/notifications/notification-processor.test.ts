import { NotificationProcessor } from '../../src/notifications/notification-processor';
import { RateLimiter } from '../../src/notifications/rate-limiter';
import { INotificationChannel } from '../../src/notifications/channels';
import { NotificationModel, UserModel } from '@pokeradar/shared';
import { INotificationPayload, ILogger } from '@pokeradar/shared';

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

function createMockChannel(overrides: Partial<INotificationChannel> = {}): INotificationChannel {
  return {
    name: 'telegram',
    send: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

let testUserId: string;

describe('NotificationProcessor', () => {
  const retryConfig = {
    maxAttempts: 3,
    initialDelayMs: 10,
    maxDelayMs: 100,
  };

  let processor: NotificationProcessor;
  let channel: INotificationChannel;
  let rateLimiter: RateLimiter;

  beforeEach(async () => {
    jest.clearAllMocks();
    processor = new NotificationProcessor(retryConfig, mockLogger);
    channel = createMockChannel();
    rateLimiter = new RateLimiter(100, 100); // generous limits for tests
    processor.registerChannel(channel, rateLimiter);

    // Create a user with a linked telegram channel so the processor can build deliveries
    const user = await UserModel.create({
      clerkId: `clerk-${Date.now()}`,
      telegram: { channelId: 'chat-123', linkToken: null },
    });
    testUserId = user._id.toString();
  });

  async function createPendingNotification() {
    const doc = await NotificationModel.create({
      userId: testUserId,
      status: 'pending',
      payload: mockPayload,
      deliveries: [],
    });
    return doc;
  }

  describe('successful delivery', () => {
    it('sends notification via the channel and marks as sent', async () => {
      const doc = await createPendingNotification();

      processor.enqueue(doc);
      await processor.drain();

      expect(channel.send).toHaveBeenCalledTimes(1);
      const [target, payload] = (channel.send as jest.Mock).mock.calls[0];
      expect(target).toBe('chat-123');
      expect(payload.productName).toBe(mockPayload.productName);
      expect(payload.price).toBe(mockPayload.price);
      expect(payload.shopName).toBe(mockPayload.shopName);

      const updated = await NotificationModel.findById(doc._id).lean();
      expect(updated!.status).toBe('sent');
      expect(updated!.deliveries[0].status).toBe('sent');
      expect(updated!.deliveries[0].sentAt).toBeDefined();
    });

    it('processes multiple notifications in order', async () => {
      const doc1 = await createPendingNotification();
      const doc2 = await createPendingNotification();

      processor.enqueue(doc1);
      processor.enqueue(doc2);
      await processor.drain();

      expect(channel.send).toHaveBeenCalledTimes(2);

      const updated1 = await NotificationModel.findById(doc1._id).lean();
      const updated2 = await NotificationModel.findById(doc2._id).lean();
      expect(updated1!.status).toBe('sent');
      expect(updated2!.status).toBe('sent');
    });
  });

  describe('retry on failure', () => {
    it('retries and succeeds on second attempt', async () => {
      const failingChannel = createMockChannel({
        send: jest
          .fn()
          .mockRejectedValueOnce(new Error('Temporary error'))
          .mockResolvedValueOnce(undefined),
      });
      processor = new NotificationProcessor(retryConfig, mockLogger);
      processor.registerChannel(failingChannel, rateLimiter);

      const doc = await createPendingNotification();
      processor.enqueue(doc);
      await processor.drain();

      expect(failingChannel.send).toHaveBeenCalledTimes(2);

      const updated = await NotificationModel.findById(doc._id).lean();
      expect(updated!.status).toBe('sent');
      expect(updated!.deliveries[0].status).toBe('sent');
    });

    it('marks as failed after exhausting all retries', async () => {
      const failingChannel = createMockChannel({
        send: jest.fn().mockRejectedValue(new Error('Persistent error')),
      });
      processor = new NotificationProcessor(retryConfig, mockLogger);
      processor.registerChannel(failingChannel, rateLimiter);

      const doc = await createPendingNotification();
      processor.enqueue(doc);
      await processor.drain();

      expect(failingChannel.send).toHaveBeenCalledTimes(3); // maxAttempts

      const updated = await NotificationModel.findById(doc._id).lean();
      // Overall status is still 'sent' (processing complete), but delivery is 'failed'
      expect(updated!.deliveries[0].status).toBe('failed');
      expect(updated!.deliveries[0].attempts).toBe(3);
      expect(updated!.deliveries[0].error).toBe('Persistent error');
    });
  });

  describe('no channels configured', () => {
    it('marks notification as sent when user has no channels', async () => {
      // Create a user with no linked channels
      const noChannelUser = await UserModel.create({
        clerkId: `clerk-nochannel-${Date.now()}`,
        telegram: { channelId: null, linkToken: null },
      });

      const doc = await NotificationModel.create({
        userId: noChannelUser._id.toString(),
        status: 'pending',
        payload: mockPayload,
        deliveries: [],
      });

      processor.enqueue(doc);
      await processor.drain();

      expect(channel.send).not.toHaveBeenCalled();

      const updated = await NotificationModel.findById(doc._id).lean();
      expect(updated!.status).toBe('sent');
    });
  });

  describe('recoverPending', () => {
    it('picks up pending notifications from the database', async () => {
      await createPendingNotification();
      await createPendingNotification();
      // Create a sent one that should NOT be recovered
      await NotificationModel.create({
        userId: testUserId,
        status: 'sent',
        payload: mockPayload,
        deliveries: [
          {
            channel: 'telegram',
            channelTarget: 'chat-123',
            status: 'sent',
            attempts: 1,
            error: null,
            sentAt: new Date(),
          },
        ],
      });

      const count = await processor.recoverPending();
      await processor.drain();

      expect(count).toBe(2);
      expect(channel.send).toHaveBeenCalledTimes(2);
    });

    it('returns 0 when there are no pending notifications', async () => {
      const count = await processor.recoverPending();
      expect(count).toBe(0);
    });
  });

  describe('enqueueBatch', () => {
    it('processes a batch of notifications', async () => {
      const doc1 = await createPendingNotification();
      const doc2 = await createPendingNotification();

      processor.enqueueBatch([doc1, doc2]);
      await processor.drain();

      expect(channel.send).toHaveBeenCalledTimes(2);
    });
  });
});
