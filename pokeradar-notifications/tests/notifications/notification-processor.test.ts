import { NotificationProcessor } from '../../src/notifications/notification-processor';
import { RateLimiter } from '../../src/notifications/rate-limiter';
import { INotificationChannel } from '../../src/notifications/channels';
import { NotificationModel } from '@pokeradar/shared';
import { INotificationPayload } from '../../src/shared/types';
import { ILogger } from '../../src/shared/logger';

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

describe('NotificationProcessor', () => {
  const retryConfig = {
    maxAttempts: 3,
    initialDelayMs: 10,
    maxDelayMs: 100,
  };

  let processor: NotificationProcessor;
  let channel: INotificationChannel;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new NotificationProcessor(retryConfig, mockLogger);
    channel = createMockChannel();
    rateLimiter = new RateLimiter(100, 100); // generous limits for tests
    processor.registerChannel(channel, rateLimiter);
  });

  async function createPendingNotification() {
    const doc = await NotificationModel.create({
      userId: 'user-1',
      channel: 'telegram',
      channelTarget: 'chat-123',
      status: 'pending',
      payload: mockPayload,
      attempts: 0,
      error: null,
      sentAt: null,
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
      expect(updated!.sentAt).toBeDefined();
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
      expect(updated!.status).toBe('failed');
      expect(updated!.attempts).toBe(3);
      expect(updated!.error).toBe('Persistent error');
    });
  });

  describe('unknown channel', () => {
    it('marks notification as failed for unknown channel', async () => {
      // Bypass Mongoose enum validation by inserting directly via the driver
      const result = await NotificationModel.collection.insertOne({
        userId: 'user-1',
        channel: 'email',
        channelTarget: 'user@example.com',
        status: 'pending',
        payload: mockPayload,
        attempts: 0,
        error: null,
        sentAt: null,
        createdAt: new Date(),
      });

      const doc = await NotificationModel.findById(result.insertedId);

      processor.enqueue(doc!);
      await processor.drain();

      const updated = await NotificationModel.findById(result.insertedId).lean();
      expect(updated!.status).toBe('failed');
      expect(updated!.error).toContain('Unknown channel');
    });
  });

  describe('recoverPending', () => {
    it('picks up pending notifications from the database', async () => {
      await createPendingNotification();
      await createPendingNotification();
      // Create a sent one that should NOT be recovered
      await NotificationModel.create({
        userId: 'user-1',
        channel: 'telegram',
        channelTarget: 'chat-123',
        status: 'sent',
        payload: mockPayload,
        attempts: 0,
        error: null,
        sentAt: new Date(),
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
