import request from 'supertest';
import app from '../../src/app';
import { UserModel } from '../../src/infrastructure/database/models';

// The @clerk/express mock in setup.ts extracts the Bearer token value and uses
// it as req.auth.userId. So 'Bearer my-clerk-id' → req.auth.userId = 'my-clerk-id'.
// resolveDbUser then finds/creates a MongoDB record for that clerkId.

describe('resolveDbUser middleware', () => {
  it('creates a new MongoDB user on first authenticated request', async () => {
    const res = await request(app)
      .get('/watchlist')
      .set('Authorization', 'Bearer clerk_new_user');

    expect(res.status).not.toBe(401);
    const user = await UserModel.findOne({ clerkId: 'clerk_new_user' });
    expect(user).not.toBeNull();
    expect(user!.clerkId).toBe('clerk_new_user');
  });

  it('reuses existing MongoDB user on subsequent requests', async () => {
    await UserModel.create({ clerkId: 'clerk_existing' });

    await request(app)
      .get('/watchlist')
      .set('Authorization', 'Bearer clerk_existing');

    const count = await UserModel.countDocuments({ clerkId: 'clerk_existing' });
    expect(count).toBe(1);
  });

  it('creates separate users for different Clerk IDs', async () => {
    await request(app)
      .get('/watchlist')
      .set('Authorization', 'Bearer clerk_user_a');

    await request(app)
      .get('/watchlist')
      .set('Authorization', 'Bearer clerk_user_b');

    const userA = await UserModel.findOne({ clerkId: 'clerk_user_a' });
    const userB = await UserModel.findOne({ clerkId: 'clerk_user_b' });
    expect(userA).not.toBeNull();
    expect(userB).not.toBeNull();
    expect(userA!._id.toString()).not.toBe(userB!._id.toString());
  });
});
