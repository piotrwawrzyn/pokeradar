import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '@/context/auth-context';
import { TelegramSetup } from '@/components/notifications/telegram/telegram-setup';
import { TelegramInstructions } from '@/components/notifications/telegram/telegram-instructions';
import { TelegramStatus } from '@/components/notifications/telegram/telegram-status';
import { mockUser, mockUserNoTelegram } from '../../../__tests__/mocks/data';
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
  it('shows connected message', () => {
    render(<TelegramStatus />, { wrapper: Wrapper });
    expect(screen.getByText(/połączone z pokeradar/)).toBeInTheDocument();
  });

  it('shows unlink button', () => {
    render(<TelegramStatus />, { wrapper: Wrapper });
    expect(screen.getByRole('button', { name: /Odłącz/ })).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: /Odłącz/ }));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });
});
