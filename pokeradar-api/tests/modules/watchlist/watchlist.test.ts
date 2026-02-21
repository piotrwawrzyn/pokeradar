import request from 'supertest';
import app from '../../../src/app';
import { createTestUser } from '../../helpers/auth.helper';
import { seedProducts } from '../../helpers/db.helper';
import {
  NotificationModel,
  NotificationStateModel,
} from '../../../src/infrastructure/database/models';

describe('Watchlist API', () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const result = await createTestUser();
    token = result.token;
    userId = result.user._id.toString();
    await seedProducts();
  });

  describe('POST /watchlist', () => {
    it('should add a product to watchlist', async () => {
      const res = await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 180 });

      expect(res.status).toBe(201);
      expect(res.body.productId).toBe('pokemon-151-booster-box');
      expect(res.body.maxPrice).toBe(180);
    });

    it('should return 404 for nonexistent product', async () => {
      const res = await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: 'nonexistent', maxPrice: 100 });

      expect(res.status).toBe(404);
    });

    it('should return 409 for duplicate entry', async () => {
      await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 180 });

      const res = await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 200 });

      expect(res.status).toBe(409);
    });

    it('should return 400 for invalid body', async () => {
      const res = await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: '', maxPrice: -10 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /watchlist', () => {
    it('should return empty array when no entries', async () => {
      const res = await request(app).get('/watchlist').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return entries with only watchlist fields', async () => {
      await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 200 });

      const res = await request(app).get('/watchlist').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].productId).toBe('pokemon-151-booster-box');
      expect(res.body[0].maxPrice).toBe(200);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('createdAt');
      // Price and product name fields should not be present
      expect(res.body[0]).not.toHaveProperty('productName');
      expect(res.body[0]).not.toHaveProperty('currentBestPrice');
      expect(res.body[0]).not.toHaveProperty('currentBestShop');
      expect(res.body[0]).not.toHaveProperty('currentBestUrl');
    });

    it('should not show other users entries', async () => {
      const other = await createTestUser({});

      await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${other.token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 200 });

      const res = await request(app).get('/watchlist').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('PATCH /watchlist/:id', () => {
    it('should update maxPrice', async () => {
      const created = await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 180 });

      const res = await request(app)
        .patch(`/watchlist/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ maxPrice: 220 });

      expect(res.status).toBe(200);
      expect(res.body.maxPrice).toBe(220);
    });

    it('should return 404 for another users entry', async () => {
      const other = await createTestUser({});

      const created = await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${other.token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 180 });

      const res = await request(app)
        .patch(`/watchlist/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ maxPrice: 220 });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /watchlist/:id', () => {
    it('should delete entry', async () => {
      const created = await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 180 });

      const res = await request(app)
        .delete(`/watchlist/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      const list = await request(app).get('/watchlist').set('Authorization', `Bearer ${token}`);

      expect(list.body).toEqual([]);
    });

    it('should return 404 for another users entry', async () => {
      const other = await createTestUser({});

      const created = await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${other.token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 180 });

      const res = await request(app)
        .delete(`/watchlist/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should cascade-delete notifications and notification states', async () => {
      const created = await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 180 });

      // Create notification for this user+product
      await NotificationModel.create({
        userId,
        channel: 'telegram',
        channelTarget: '123456',
        status: 'pending',
        payload: {
          productName: 'Pokemon 151 Booster Box',
          shopName: 'Test Shop',
          shopId: 'test-shop',
          productId: 'pokemon-151-booster-box',
          price: 170,
          maxPrice: 180,
          productUrl: 'https://example.com/product',
        },
      });

      // Create notification state for this user+product+shop
      await NotificationStateModel.create({
        key: `${userId}:pokemon-151-booster-box:test-shop`,
        userId,
        productId: 'pokemon-151-booster-box',
        shopId: 'test-shop',
        lastNotified: new Date(),
        lastPrice: 170,
        wasAvailable: true,
      });

      // Verify they exist
      const notificationsBefore = await NotificationModel.find({ userId }).lean();
      const statesBefore = await NotificationStateModel.find({ userId }).lean();
      expect(notificationsBefore).toHaveLength(1);
      expect(statesBefore).toHaveLength(1);

      // Delete the watchlist entry
      const res = await request(app)
        .delete(`/watchlist/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      // Verify notifications and states were cascade-deleted
      const notificationsAfter = await NotificationModel.find({ userId }).lean();
      const statesAfter = await NotificationStateModel.find({ userId }).lean();
      expect(notificationsAfter).toHaveLength(0);
      expect(statesAfter).toHaveLength(0);
    });

    it('should only delete notifications/states for the current user, not other users', async () => {
      // Create another user
      const otherUser = await createTestUser({});
      const otherUserId = otherUser.user._id.toString();

      // Both users add the same product to watchlist
      const created = await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 180 });

      await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${otherUser.token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 190 });

      // Create notifications for both users for the same product
      await NotificationModel.create({
        userId,
        channel: 'telegram',
        channelTarget: '123456',
        status: 'pending',
        payload: {
          productName: 'Pokemon 151 Booster Box',
          shopName: 'Test Shop',
          shopId: 'test-shop',
          productId: 'pokemon-151-booster-box',
          price: 170,
          maxPrice: 180,
          productUrl: 'https://example.com/product',
        },
      });

      await NotificationModel.create({
        userId: otherUserId,
        channel: 'telegram',
        channelTarget: '654321',
        status: 'pending',
        payload: {
          productName: 'Pokemon 151 Booster Box',
          shopName: 'Test Shop',
          shopId: 'test-shop',
          productId: 'pokemon-151-booster-box',
          price: 170,
          maxPrice: 190,
          productUrl: 'https://example.com/product',
        },
      });

      // Create notification states for both users
      await NotificationStateModel.create({
        key: `${userId}:pokemon-151-booster-box:test-shop`,
        userId,
        productId: 'pokemon-151-booster-box',
        shopId: 'test-shop',
        lastNotified: new Date(),
        lastPrice: 170,
        wasAvailable: true,
      });

      await NotificationStateModel.create({
        key: `${otherUserId}:pokemon-151-booster-box:test-shop`,
        userId: otherUserId,
        productId: 'pokemon-151-booster-box',
        shopId: 'test-shop',
        lastNotified: new Date(),
        lastPrice: 170,
        wasAvailable: true,
      });

      // Verify both exist
      const allNotificationsBefore = await NotificationModel.find({}).lean();
      const allStatesBefore = await NotificationStateModel.find({}).lean();
      expect(allNotificationsBefore).toHaveLength(2);
      expect(allStatesBefore).toHaveLength(2);

      // Delete the first user's watchlist entry
      const res = await request(app)
        .delete(`/watchlist/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      // Verify only the first user's notifications/states were deleted
      const userNotifications = await NotificationModel.find({ userId }).lean();
      const userStates = await NotificationStateModel.find({ userId }).lean();
      expect(userNotifications).toHaveLength(0);
      expect(userStates).toHaveLength(0);

      // Verify the other user's notifications/states are still intact
      const otherNotifications = await NotificationModel.find({ userId: otherUserId }).lean();
      const otherStates = await NotificationStateModel.find({ userId: otherUserId }).lean();
      expect(otherNotifications).toHaveLength(1);
      expect(otherStates).toHaveLength(1);
      expect(otherNotifications[0].payload.productId).toBe('pokemon-151-booster-box');
      expect(otherStates[0].productId).toBe('pokemon-151-booster-box');
    });
  });
});
