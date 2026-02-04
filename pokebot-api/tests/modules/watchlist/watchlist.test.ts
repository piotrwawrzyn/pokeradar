import request from 'supertest';
import app from '../../../src/app';
import { createTestUser } from '../../helpers/auth.helper';
import { seedProducts } from '../../helpers/db.helper';

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
      const res = await request(app)
        .get('/watchlist')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return entries with only watchlist fields', async () => {
      await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 200 });

      const res = await request(app)
        .get('/watchlist')
        .set('Authorization', `Bearer ${token}`);

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
      const other = await createTestUser({ googleId: 'other-google', email: 'other@test.com' });

      await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${other.token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 200 });

      const res = await request(app)
        .get('/watchlist')
        .set('Authorization', `Bearer ${token}`);

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
      const other = await createTestUser({ googleId: 'other-google', email: 'other@test.com' });

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

      const list = await request(app)
        .get('/watchlist')
        .set('Authorization', `Bearer ${token}`);

      expect(list.body).toEqual([]);
    });

    it('should return 404 for another users entry', async () => {
      const other = await createTestUser({ googleId: 'other-google', email: 'other@test.com' });

      const created = await request(app)
        .post('/watchlist')
        .set('Authorization', `Bearer ${other.token}`)
        .send({ productId: 'pokemon-151-booster-box', maxPrice: 180 });

      const res = await request(app)
        .delete(`/watchlist/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
