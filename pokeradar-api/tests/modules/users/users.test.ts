import request from 'supertest';
import app from '../../../src/app';
import { createTestUser } from '../../helpers/auth.helper';
import { UserModel } from '../../../src/infrastructure/database/models';

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
      const res = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBeDefined();
      expect(res.body.displayName).toBe('Test User');
      expect(res.body.telegram.linked).toBe(false);
      expect(res.body.discord.linked).toBe(false);
    });

    it('should return telegram.linked true when channelId is set', async () => {
      await UserModel.updateOne(
        { _id: userId },
        { $set: { 'telegram.channelId': '123456789' } }
      );

      const res = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`);

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
      expect(user!.telegram.linkToken).toBe(res.body.linkToken);
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
      expect(user!.telegram.linkToken).toBe(res2.body.linkToken);
    });
  });

  describe('DELETE /users/me/telegram', () => {
    it('should clear telegram.channelId and telegram.linkToken', async () => {
      await UserModel.updateOne(
        { _id: userId },
        { $set: { 'telegram.channelId': '123456789', 'telegram.linkToken': 'some-token' } }
      );

      const res = await request(app)
        .delete('/users/me/telegram')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      const user = await UserModel.findById(userId).lean();
      expect(user!.telegram.channelId).toBeNull();
      expect(user!.telegram.linkToken).toBeNull();
    });

    it('should return 204 even when already unlinked', async () => {
      const res = await request(app)
        .delete('/users/me/telegram')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
    });
  });
});
