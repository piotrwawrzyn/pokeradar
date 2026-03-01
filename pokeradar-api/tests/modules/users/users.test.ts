import request from 'supertest';
import { Types } from 'mongoose';
import app from '../../../src/app';
import { createTestUser } from '../../helpers/auth.helper';
import {
  UserModel,
  UserWatchEntryModel,
  NotificationStateModel,
  NotificationModel,
} from '../../../src/infrastructure/database/models';

describe('Users API', () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const result = await createTestUser();
    token = result.token;
    userId = result.user._id.toString();
  });

  describe('GET /users/me', () => {
    it('should return user profile', async () => {
      const res = await request(app).get('/users/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBeDefined();
      expect(res.body.displayName).toBe('Test User');
      expect(res.body.telegram.linked).toBe(false);
      expect(res.body.discord.linked).toBe(false);
    });

    it('should return telegram.linked true when channelId is set', async () => {
      await UserModel.updateOne({ _id: userId }, { $set: { 'telegram.channelId': '123456789' } });

      const res = await request(app).get('/users/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.telegram.linked).toBe(true);
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/users/me');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /users/me/telegram/link-token', () => {
    it('should generate and return a link token', async () => {
      const res = await request(app)
        .post('/users/me/telegram/link-token')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.linkToken).toBeDefined();
      expect(typeof res.body.linkToken).toBe('string');
      expect(res.body.linkToken.length).toBeGreaterThan(10);

      // Verify it's stored in DB
      const user = await UserModel.findById(userId).lean();
      expect(user!.telegram?.linkToken).toBe(res.body.linkToken);
    });

    it('should overwrite previous token on second call', async () => {
      const res1 = await request(app)
        .post('/users/me/telegram/link-token')
        .set('Authorization', `Bearer ${token}`);

      const res2 = await request(app)
        .post('/users/me/telegram/link-token')
        .set('Authorization', `Bearer ${token}`);

      expect(res1.body.linkToken).not.toBe(res2.body.linkToken);

      const user = await UserModel.findById(userId).lean();
      expect(user!.telegram?.linkToken).toBe(res2.body.linkToken);
    });
  });

  describe('DELETE /users/me/telegram', () => {
    it('should clear telegram.channelId and telegram.linkToken', async () => {
      await UserModel.updateOne(
        { _id: userId },
        { $set: { 'telegram.channelId': '123456789', 'telegram.linkToken': 'some-token' } },
      );

      const res = await request(app)
        .delete('/users/me/telegram')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const user = await UserModel.findById(userId).lean();
      expect(user!.telegram?.channelId).toBeNull();
      expect(user!.telegram?.linkToken).toBeNull();
    });

    it('should return watchlistCleared false even when already unlinked', async () => {
      const res = await request(app)
        .delete('/users/me/telegram')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.watchlistCleared).toBe(false);
    });

    it('should clear watchlist when unlinking the last channel', async () => {
      await UserModel.updateOne({ _id: userId }, { $set: { 'telegram.channelId': '123456789' } });
      await UserWatchEntryModel.create({
        userId: new Types.ObjectId(userId),
        productId: 'test-product',
        maxPrice: 100,
      });
      await NotificationStateModel.create({
        key: `${userId}:test-product:shop-a`,
        userId,
        productId: 'test-product',
        shopId: 'shop-a',
        lastNotified: null,
        lastPrice: null,
        wasAvailable: false,
      });
      await NotificationModel.create({
        userId,
        status: 'pending',
        payload: {
          productName: 'Test',
          shopName: 'Shop A',
          shopId: 'shop-a',
          productId: 'test-product',
          price: 90,
          maxPrice: 100,
          productUrl: 'https://example.com',
        },
        deliveries: [],
      });

      const res = await request(app)
        .delete('/users/me/telegram')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.watchlistCleared).toBe(true);

      const entries = await UserWatchEntryModel.find({ userId: new Types.ObjectId(userId) });
      expect(entries).toHaveLength(0);

      const states = await NotificationStateModel.find({ userId });
      expect(states).toHaveLength(0);

      const notifications = await NotificationModel.find({ userId, status: 'pending' });
      expect(notifications).toHaveLength(0);
    });

    it('should NOT clear watchlist when the other channel is still linked', async () => {
      await UserModel.updateOne(
        { _id: userId },
        {
          $set: {
            'telegram.channelId': '123456789',
            'discord.channelId': 'discord-user-id',
          },
        },
      );
      await UserWatchEntryModel.create({
        userId: new Types.ObjectId(userId),
        productId: 'test-product',
        maxPrice: 100,
      });

      const res = await request(app)
        .delete('/users/me/telegram')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.watchlistCleared).toBe(false);

      const entries = await UserWatchEntryModel.find({ userId: new Types.ObjectId(userId) });
      expect(entries).toHaveLength(1);
    });

    it('should return watchlistCleared false when no watchlist items exist', async () => {
      await UserModel.updateOne({ _id: userId }, { $set: { 'telegram.channelId': '123456789' } });

      const res = await request(app)
        .delete('/users/me/telegram')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.watchlistCleared).toBe(false);
    });

    it('should only clear the unlinking user watchlist, not other users', async () => {
      const { user: user2, token: token2 } = await createTestUser();
      const userId2 = user2._id.toString();

      await UserModel.updateOne({ _id: userId }, { $set: { 'telegram.channelId': 'tg-user-1' } });
      await UserModel.updateOne({ _id: userId2 }, { $set: { 'telegram.channelId': 'tg-user-2' } });

      await UserWatchEntryModel.create({
        userId: new Types.ObjectId(userId),
        productId: 'test-product',
        maxPrice: 100,
      });
      await UserWatchEntryModel.create({
        userId: new Types.ObjectId(userId2),
        productId: 'test-product',
        maxPrice: 120,
      });

      const res = await request(app)
        .delete('/users/me/telegram')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.watchlistCleared).toBe(true);

      const user1Entries = await UserWatchEntryModel.find({ userId: new Types.ObjectId(userId) });
      expect(user1Entries).toHaveLength(0);

      const user2Entries = await UserWatchEntryModel.find({
        userId: new Types.ObjectId(userId2),
      });
      expect(user2Entries).toHaveLength(1);

      // Cleanup: needed because token2 is not used elsewhere so no afterEach would clean it
      await request(app).delete('/users/me/telegram').set('Authorization', `Bearer ${token2}`);
    });
  });

  describe('DELETE /users/me/discord', () => {
    it('should clear discord.channelId and discord.linkToken', async () => {
      await UserModel.updateOne(
        { _id: userId },
        { $set: { 'discord.channelId': 'discord-user-id', 'discord.linkToken': 'some-token' } },
      );

      const res = await request(app)
        .delete('/users/me/discord')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const user = await UserModel.findById(userId).lean();
      expect(user!.discord?.channelId).toBeNull();
      expect(user!.discord?.linkToken).toBeNull();
    });

    it('should clear watchlist when unlinking the last channel', async () => {
      await UserModel.updateOne(
        { _id: userId },
        { $set: { 'discord.channelId': 'discord-user-id' } },
      );
      await UserWatchEntryModel.create({
        userId: new Types.ObjectId(userId),
        productId: 'test-product',
        maxPrice: 100,
      });

      const res = await request(app)
        .delete('/users/me/discord')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.watchlistCleared).toBe(true);

      const entries = await UserWatchEntryModel.find({ userId: new Types.ObjectId(userId) });
      expect(entries).toHaveLength(0);
    });

    it('should NOT clear watchlist when telegram is still linked', async () => {
      await UserModel.updateOne(
        { _id: userId },
        {
          $set: {
            'discord.channelId': 'discord-user-id',
            'telegram.channelId': '123456789',
          },
        },
      );
      await UserWatchEntryModel.create({
        userId: new Types.ObjectId(userId),
        productId: 'test-product',
        maxPrice: 100,
      });

      const res = await request(app)
        .delete('/users/me/discord')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.watchlistCleared).toBe(false);

      const entries = await UserWatchEntryModel.find({ userId: new Types.ObjectId(userId) });
      expect(entries).toHaveLength(1);
    });
  });
});
