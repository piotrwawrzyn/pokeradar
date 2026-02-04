import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '@/context/auth-context';
import { TOKEN_KEY } from '@/api/client';
import { TelegramSetup } from '@/components/notifications/telegram/telegram-setup';
import { TelegramInstructions } from '@/components/notifications/telegram/telegram-instructions';
import { TelegramStatus } from '@/components/notifications/telegram/telegram-status';
import { mockUser, mockUserNoTelegram } from '../mocks/data';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

function makeWrapper(user: typeof mockUser) {
  const authValue = {
    token: 'test',
    user,
    isAuthenticated: true,
    isLoading: false,
    login: () => {},
    logout: () => {},
  };

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={createQueryClient()}>
        <AuthContext.Provider value={authValue}>
          <BrowserRouter>{children}</BrowserRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
  };
}

describe('TelegramSetup', () => {
  it('shows instructions when Telegram is not linked', async () => {
    server.use(
      http.get('http://localhost:3000/users/me', () => {
        return HttpResponse.json(mockUserNoTelegram);
      }),
    );

    render(<TelegramSetup />, { wrapper: makeWrapper(mockUserNoTelegram) });

    await waitFor(() => {
      expect(screen.getByText(/Jak polaczyc Telegram/)).toBeInTheDocument();
    });
  });

  it('shows connected status when Telegram is linked', async () => {
    server.use(
      http.get('http://localhost:3000/users/me', () => {
        return HttpResponse.json(mockUser);
      }),
    );

    render(<TelegramSetup />, { wrapper: makeWrapper(mockUser) });

    await waitFor(() => {
      expect(screen.getByText('Polaczony')).toBeInTheDocument();
    });
  });
});

describe('TelegramInstructions', () => {
  const Wrapper = makeWrapper(mockUserNoTelegram);

  beforeEach(() => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
  });

  it('shows step-by-step instructions', () => {
    render(<TelegramInstructions />, { wrapper: Wrapper });

    expect(screen.getByText(/Otworz Telegram/)).toBeInTheDocument();
    expect(screen.getByText(/@tcg_pokemon_bot/)).toBeInTheDocument();
    expect(screen.getByText(/Wygeneruj token polaczenia/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wygeneruj token/ })).toBeInTheDocument();
  });

  it('generates a token and shows step 3 with the token', async () => {
    render(<TelegramInstructions />, { wrapper: Wrapper });

    const generateBtn = screen.getByRole('button', { name: /Wygeneruj token/ });
    await userEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText(/abc123token/)).toBeInTheDocument();
    });
  });

  it('does not show step 3 before token is generated', () => {
    render(<TelegramInstructions />, { wrapper: Wrapper });
    expect(screen.queryByText(/\/link/)).not.toBeInTheDocument();
  });
});

describe('TelegramStatus', () => {
  const Wrapper = makeWrapper(mockUser);

  beforeEach(() => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
  });

  it('shows connected badge', () => {
    render(<TelegramStatus />, { wrapper: Wrapper });
    expect(screen.getByText('Polaczony')).toBeInTheDocument();
  });

  it('shows unlink button', () => {
    render(<TelegramStatus />, { wrapper: Wrapper });
    expect(screen.getByRole('button', { name: /Odlacz/ })).toBeInTheDocument();
  });

  it('calls DELETE when unlink button is clicked', async () => {
    let deleteCalled = false;
    server.use(
      http.delete('http://localhost:3000/users/me/telegram', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    render(<TelegramStatus />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole('button', { name: /Odlacz/ }));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });
});
