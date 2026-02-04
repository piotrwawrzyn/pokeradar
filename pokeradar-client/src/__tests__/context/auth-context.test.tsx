import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/auth-context';
import { useAuth } from '@/hooks/use-auth';
import { TOKEN_KEY } from '@/api/client';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function TestConsumer() {
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="authenticated">{String(isAuthenticated)}</p>
      <p data-testid="user">{user?.displayName ?? 'none'}</p>
      <button onClick={() => login('test-token')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

function renderAuth() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('AuthContext', () => {
  it('starts unauthenticated when no token in localStorage', async () => {
    renderAuth();
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('validates token on mount and sets user', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token');
    renderAuth();

    // Initially loading
    expect(screen.getByTestId('loading').textContent).toBe('true');

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('Test User');
  });

  it('logs out if token validation fails (401)', async () => {
    server.use(
      http.get('http://localhost:3000/auth/me', () => {
        return new HttpResponse(null, { status: 401 });
      }),
    );

    localStorage.setItem(TOKEN_KEY, 'invalid-token');
    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('login() stores token and fetches user', async () => {
    const { getByText } = renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
    expect(localStorage.getItem(TOKEN_KEY)).toBe('test-token');
    expect(screen.getByTestId('user').textContent).toBe('Test User');
  });

  it('logout() clears token and user', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token');
    const { getByText } = renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    await act(async () => {
      getByText('Logout').click();
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
