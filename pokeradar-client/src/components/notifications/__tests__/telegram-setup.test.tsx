import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '@/context/auth-context-value';
import { TelegramSetup } from '@/components/notifications/telegram/telegram-setup';
import { TelegramInstructions } from '@/components/notifications/telegram/telegram-instructions';
import { TelegramStatus } from '@/components/notifications/telegram/telegram-status';
import {
  mockUser,
  mockUserNoTelegram,
  mockUserBothLinked,
  mockWatchlist,
} from '../../../__tests__/mocks/data';
import { server } from '../../../__tests__/mocks/server';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

const authValue = {
  user: { id: mockUser.id, email: mockUser.email, displayName: mockUser.displayName },
  isAuthenticated: true,
  isLoading: false,
  login: () => {},
  logout: async () => {},
};

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <AuthContext.Provider value={authValue}>
        <BrowserRouter>{children}</BrowserRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

describe('TelegramSetup', () => {
  it('shows instructions when Telegram is not linked', async () => {
    server.use(
      http.get('http://localhost:3000/users/me', () => {
        return HttpResponse.json(mockUserNoTelegram);
      }),
    );

    render(<TelegramSetup />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Jak połączyć Telegram/)).toBeInTheDocument();
    });
  });

  it('shows connected status when Telegram is linked', async () => {
    server.use(
      http.get('http://localhost:3000/users/me', () => {
        return HttpResponse.json(mockUser);
      }),
    );

    render(<TelegramSetup />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/połączone z pokeradar/)).toBeInTheDocument();
    });
  });
});

describe('TelegramInstructions', () => {
  it('shows step-by-step instructions', () => {
    server.use(
      http.get('http://localhost:3000/users/me', () => {
        return HttpResponse.json(mockUserNoTelegram);
      }),
    );

    render(<TelegramInstructions />, { wrapper: Wrapper });

    expect(screen.getByText(/Otwórz Telegram/)).toBeInTheDocument();
    expect(screen.getByText(/Wygeneruj token połączenia/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wygeneruj token/ })).toBeInTheDocument();
  });

  it('generates a token and shows the token', async () => {
    server.use(
      http.get('http://localhost:3000/users/me', () => {
        return HttpResponse.json(mockUserNoTelegram);
      }),
      http.get('http://localhost:3000/users/me/link-status/stream', () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );

    render(<TelegramInstructions />, { wrapper: Wrapper });

    const generateBtn = screen.getByRole('button', { name: /Wygeneruj token/ });
    await userEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText(/abc123token/)).toBeInTheDocument();
    });
  });

  it('does not show token before it is generated', () => {
    server.use(
      http.get('http://localhost:3000/users/me', () => {
        return HttpResponse.json(mockUserNoTelegram);
      }),
    );

    render(<TelegramInstructions />, { wrapper: Wrapper });
    expect(screen.queryByText(/\/link/)).not.toBeInTheDocument();
  });
});

describe('TelegramStatus', () => {
  it('shows connected message', async () => {
    server.use(
      http.get('http://localhost:3000/users/me', () => HttpResponse.json(mockUser)),
      http.get('http://localhost:3000/watchlist', () => HttpResponse.json([])),
    );
    render(<TelegramStatus />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText(/połączone z pokeradar/)).toBeInTheDocument();
    });
  });

  it('shows unlink button', async () => {
    server.use(
      http.get('http://localhost:3000/users/me', () => HttpResponse.json(mockUser)),
      http.get('http://localhost:3000/watchlist', () => HttpResponse.json([])),
    );
    render(<TelegramStatus />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Odłącz/ })).toBeInTheDocument();
    });
  });

  it('calls DELETE when unlink button is clicked (other channel still linked — no dialog)', async () => {
    let deleteCalled = false;
    server.use(
      // Both channels linked → not the last channel → no confirmation dialog
      http.get('http://localhost:3000/users/me', () => HttpResponse.json(mockUserBothLinked)),
      http.get('http://localhost:3000/watchlist', () => HttpResponse.json(mockWatchlist)),
      http.delete('http://localhost:3000/users/me/telegram', () => {
        deleteCalled = true;
        return HttpResponse.json({ watchlistCleared: false });
      }),
    );

    render(<TelegramStatus />, { wrapper: Wrapper });
    await waitFor(() => screen.getByRole('button', { name: /Odłącz/ }));
    await userEvent.click(screen.getByRole('button', { name: /Odłącz/ }));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });

  it('shows confirmation dialog when unlinking the last channel with watchlist items', async () => {
    server.use(
      // Only telegram linked → isLastChannel=true; has watchlist items → dialog shown
      http.get('http://localhost:3000/users/me', () => HttpResponse.json(mockUser)),
      http.get('http://localhost:3000/watchlist', () => HttpResponse.json(mockWatchlist)),
    );

    render(<TelegramStatus />, { wrapper: Wrapper });

    // Wait for both queries (profile + watchlist) to settle so that
    // isLastChannel and watchlistCount are computed before we click.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Odłącz/ })).toBeInTheDocument();
    });
    // Give React Query a tick to apply all query results
    await new Promise((r) => setTimeout(r, 50));

    await userEvent.click(screen.getByRole('button', { name: /Odłącz/ }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/To jedyny skonfigurowany kanał/)).toBeInTheDocument();
  });
});
