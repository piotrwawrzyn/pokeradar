import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '@/context/auth-context';
import { TOKEN_KEY } from '@/api/client';
import { MaxPriceInput } from '@/components/watchlist/max-price-input';
import { mockUser } from '../mocks/data';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

const authValue = {
  token: 'test',
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
  login: () => {},
  logout: () => {},
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

describe('MaxPriceInput', () => {
  beforeEach(() => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
  });

  it('renders with the current max price', () => {
    render(
      <Wrapper>
        <MaxPriceInput entryId="watch-1" currentMaxPrice={150} currentBestPrice={179.99} />
      </Wrapper>,
    );
    const input = screen.getByLabelText('Maksymalna cena');
    expect(input).toHaveValue(150);
  });

  it('shows validation error when value exceeds current best price', async () => {
    render(
      <Wrapper>
        <MaxPriceInput entryId="watch-1" currentMaxPrice={150} currentBestPrice={179.99} />
      </Wrapper>,
    );

    const input = screen.getByLabelText('Maksymalna cena');
    await userEvent.clear(input);
    await userEvent.type(input, '200');

    await waitFor(
      () => {
        expect(screen.getByText(/nie moze przekraczac/)).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('shows validation error for invalid (non-positive) values', async () => {
    render(
      <Wrapper>
        <MaxPriceInput entryId="watch-1" currentMaxPrice={150} currentBestPrice={179.99} />
      </Wrapper>,
    );

    const input = screen.getByLabelText('Maksymalna cena');
    await userEvent.clear(input);
    await userEvent.type(input, '0');

    await waitFor(
      () => {
        expect(screen.getByText(/Podaj prawidlowa kwote/)).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('sends PATCH request after debounce with valid value', async () => {
    let patchCalled = false;
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.patch('http://localhost:3000/watchlist/watch-1', async ({ request }) => {
        patchCalled = true;
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: 'watch-1',
          productId: 'prod-1',
          maxPrice: 120,
        });
      }),
    );

    render(
      <Wrapper>
        <MaxPriceInput entryId="watch-1" currentMaxPrice={150} currentBestPrice={179.99} />
      </Wrapper>,
    );

    const input = screen.getByLabelText('Maksymalna cena');
    await userEvent.clear(input);
    await userEvent.type(input, '120');

    await waitFor(
      () => {
        expect(patchCalled).toBe(true);
      },
      { timeout: 2000 },
    );
    expect(patchBody).toEqual({ maxPrice: 120 });
  });

  it('does not send PATCH if value equals current max price', async () => {
    let patchCalled = false;
    server.use(
      http.patch('http://localhost:3000/watchlist/watch-1', async () => {
        patchCalled = true;
        return HttpResponse.json({});
      }),
    );

    render(
      <Wrapper>
        <MaxPriceInput entryId="watch-1" currentMaxPrice={150} currentBestPrice={179.99} />
      </Wrapper>,
    );

    // Wait for more than the debounce period — value hasn't changed from initial
    await new Promise((r) => setTimeout(r, 700));
    expect(patchCalled).toBe(false);
  });
});
