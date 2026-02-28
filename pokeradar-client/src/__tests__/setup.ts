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
    getToken: vi.fn().mockResolvedValue('test-token'),
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

// Provide window.Clerk.session.getToken for the axios interceptor
(window as unknown as { Clerk: { session: { getToken: () => Promise<string> } } }).Clerk = {
  session: { getToken: () => Promise.resolve('test-token') },
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());
