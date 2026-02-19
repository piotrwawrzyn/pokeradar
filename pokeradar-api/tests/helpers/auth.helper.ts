import { UserModel } from '../../src/infrastructure/database/models';

export async function createTestUser(overrides: Record<string, unknown> = {}) {
  const uniqueId = Date.now().toString() + Math.random().toString(36).slice(2);
  // Default clerkId is unique; pass { clerkId: 'specific-id' } to control identity.
  const clerkId = (overrides.clerkId as string) ?? `clerk_${uniqueId}`;

  const user = await UserModel.create({
    clerkId,
    // Unknown fields (googleId, email, etc.) are silently ignored by Mongoose strict mode
  });

  // The Clerk mock in setup.ts extracts the Bearer token and uses it as
  // req.auth.userId — so the token IS the clerkId, enabling multi-user isolation.
  const token = clerkId;

  return { user, token };
}
