import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app';

describe('Auth Middleware', () => {
  it('should return 401 without Authorization header', async () => {
    const res = await request(app).get('/watchlist');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Missing or invalid authorization header');
  });

  it('should return 401 with malformed header', async () => {
    const res = await request(app)
      .get('/watchlist')
      .set('Authorization', 'NotBearer token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Missing or invalid authorization header');
  });

  it('should return 401 with invalid token', async () => {
    const res = await request(app)
      .get('/watchlist')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });

  it('should return 401 with expired token', async () => {
    const token = jwt.sign(
      { userId: 'some-id', email: 'test@test.com' },
      process.env.JWT_SECRET!,
      { expiresIn: '-1s' } as jwt.SignOptions
    );

    const res = await request(app)
      .get('/watchlist')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });
});
