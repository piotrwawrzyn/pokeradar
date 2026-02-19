import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './mocks/server';

// Mock @clerk/clerk-react so tests work without a real Clerk instance.
// AuthProvider reads these hooks to populate AuthContext.
// Individual tests can override with vi.mocked(...).mockReturnValueOnce(...).
vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  useAuth: vi.fn(() => ({
    isSignedIn: true,
    isLoaded: true,
    signOut: vi.fn().mockResolvedValue(undefined),
  })),
  useUser: vi.fn(() => ({
    user: {
      id: 'clerk-test-id',
      primaryEmailAddress: { emailAddress: 'test@example.com' },
      fullName: 'Test User',
      publicMetadata: {},
    },
    isLoaded: true,
  })),
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());
