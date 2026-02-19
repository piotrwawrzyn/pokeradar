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
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  requireAuth: () => (req: any, _res: any, next: any) => {
    const authHeader = req.headers['authorization'] as string | undefined;
    const clerkId =
      authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : 'clerk_anonymous';
    req.auth = { userId: clerkId, sessionClaims: { metadata: {} } };
    next();
  },
  // getAuth reads the auth object set by requireAuth above
  getAuth: (req: any) => req.auth ?? { userId: null, sessionClaims: {} },
  clerkClient: {
    users: {
      getUser: jest.fn(),
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
});
