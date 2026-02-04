import jwt from 'jsonwebtoken';
import { UserModel } from '../../src/infrastructure/database/models';

export async function createTestUser(overrides: Record<string, unknown> = {}) {
  const uniqueId = Date.now().toString() + Math.random().toString(36).slice(2);
  const user = await UserModel.create({
    googleId: `google-${uniqueId}`,
    email: `test-${uniqueId}@example.com`,
    displayName: 'Test User',
    ...overrides,
  });

  const token = jwt.sign(
    { userId: user._id.toString(), email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' } as jwt.SignOptions
  );

  return { user, token };
}
