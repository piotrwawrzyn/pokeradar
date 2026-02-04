import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

// Set env vars before any app imports (env.ts validates at import time)
process.env.MONGODB_URI = 'mongodb://localhost:27017/test-placeholder';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

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
