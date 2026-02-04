export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['**/*.test.ts'],
  // Increase timeout for mongodb-memory-server startup
  testTimeout: 30000,
};
