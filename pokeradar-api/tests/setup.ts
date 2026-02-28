import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

// Set env vars before any app imports (env.ts validates at import time)
process.env.MONGODB_URI = 'mongodb://localhost:27017/test-placeholder';
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_fakepublishablekey';
process.env.CLERK_SECRET_KEY = 'sk_test_fakeclerkkey';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

// Mock @clerk/express so tests work without a real Clerk instance.
// requireAuth extracts the Bearer token and uses it as the Clerk userId —
// this allows multi-user tests to simulate different users by using different tokens.
jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: () => (req: { headers: Record<string, string | undefined>; auth?: unknown }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const clerkId = authHeader.slice(7);
    req.auth = { userId: clerkId, sessionClaims: { metadata: {} } };
    next();
  },
  // getAuth reads the auth object set by requireAuth above
  getAuth: (req: { auth?: unknown }) => req.auth ?? { userId: null, sessionClaims: {} },
  clerkClient: {
    users: {
      getUser: jest.fn().mockImplementation((clerkId: string) =>
        Promise.resolve({
          id: clerkId,
          emailAddresses: [{ emailAddress: 'test@example.com' }],
          fullName: 'Test User',
        }),
      ),
      getUserList: jest.fn(),
    },
    instance: {
      get: jest.fn(),
      update: jest.fn(),
    },
  },
}));

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
  // Drop and recreate the users collection to reset sparse unique indexes
  // that treat explicit null channelId values as duplicates.
  if (collections['users']) {
    await collections['users'].drop().catch(() => {});
  }
});
