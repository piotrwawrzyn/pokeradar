import request from 'supertest';
import app from '../../../src/app';
import { createTestUser } from '../../helpers/auth.helper';
import { seedProducts, seedProductResults } from '../../helpers/db.helper';

describe('Products API', () => {
  let token: string;

  beforeEach(async () => {
    const result = await createTestUser();
    token = result.token;
    await seedProducts();
  });

  describe('GET /products', () => {
    it('should return all products with price fields', async () => {
      const res = await request(app)
        .get('/products')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('currentBestPrice');
      expect(res.body[0]).toHaveProperty('currentBestShop');
      expect(res.body[0]).toHaveProperty('currentBestUrl');
    });

    it('should return null price fields when no recent results exist', async () => {
      const res = await request(app).get('/products');

      expect(res.status).toBe(200);
      const product = res.body.find((p: any) => p.id === 'pokemon-151-booster-box');
      expect(product.currentBestPrice).toBeNull();
      expect(product.currentBestShop).toBeNull();
      expect(product.currentBestUrl).toBeNull();
    });

    it('should return correct best price when results exist', async () => {
      await seedProductResults('pokemon-151-booster-box');

      const res = await request(app).get('/products');

      expect(res.status).toBe(200);
      const product = res.body.find((p: any) => p.id === 'pokemon-151-booster-box');
      // shop-a has 179.99 (available), shop-b has 199.99 (available), shop-c has 159.99 (unavailable)
      // Best available price should be 179.99 from shop-a
      expect(product.currentBestPrice).toBe(179.99);
      expect(product.currentBestShop).toBe('shop-a');
      expect(product.currentBestUrl).toBe('https://shop-a.pl/product/1');
    });

    it('should be accessible without auth token', async () => {
      const res = await request(app).get('/products');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });
  });

  describe('GET /products/:id', () => {
    it('should return a single product', async () => {
      const res = await request(app)
        .get('/products/pokemon-151-booster-box')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('pokemon-151-booster-box');
      expect(res.body.name).toBe('Pokemon 151 Booster Box');
    });

    it('should return 404 for nonexistent product', async () => {
      const res = await request(app)
        .get('/products/nonexistent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /products/:id/prices', () => {
    it('should return prices sorted by price', async () => {
      await seedProductResults('pokemon-151-booster-box');

      const res = await request(app)
        .get('/products/pokemon-151-booster-box/prices')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('shopId');
      expect(res.body[0]).toHaveProperty('price');
      expect(res.body[0]).toHaveProperty('isAvailable');

      // Verify sorted by price ascending
      for (let i = 1; i < res.body.length; i++) {
        if (res.body[i].price !== null && res.body[i - 1].price !== null) {
          expect(res.body[i].price).toBeGreaterThanOrEqual(res.body[i - 1].price);
        }
      }
    });

    it('should return empty array when no results', async () => {
      const res = await request(app)
        .get('/products/pokemon-151-booster-box/prices')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return 404 for nonexistent product', async () => {
      const res = await request(app)
        .get('/products/nonexistent/prices')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
