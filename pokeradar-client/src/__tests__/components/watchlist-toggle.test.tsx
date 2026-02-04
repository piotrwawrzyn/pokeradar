import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '@/context/auth-context';
import { WatchlistToggle } from '@/components/watchlist/watchlist-toggle';
import { mockProducts, mockWatchlist, mockUser } from '../mocks/data';
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

describe('WatchlistToggle', () => {
  const product = mockProducts[0]; // Pikachu VMAX
  const entry = mockWatchlist[0]; // watched entry for prod-1

  it('renders as unchecked when no entry exists', () => {
    render(
      <Wrapper>
        <WatchlistToggle product={product} entry={undefined} disabled={false} />
      </Wrapper>,
    );
    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();
  });

  it('renders as checked when entry exists', () => {
    render(
      <Wrapper>
        <WatchlistToggle product={product} entry={entry} disabled={false} />
      </Wrapper>,
    );
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeChecked();
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <Wrapper>
        <WatchlistToggle product={product} entry={undefined} disabled={true} />
      </Wrapper>,
    );
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();
  });

  it('is disabled for disabled products', () => {
    const disabledProduct = mockProducts[4]; // disabled=true
    render(
      <Wrapper>
        <WatchlistToggle product={disabledProduct} entry={undefined} disabled={false} />
      </Wrapper>,
    );
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();
  });

  it('calls POST /watchlist when toggled on', async () => {
    let postCalled = false;
    server.use(
      http.post('http://localhost:3000/watchlist', async () => {
        postCalled = true;
        return HttpResponse.json({
          id: 'watch-new',
          productId: 'prod-1',
          maxPrice: 179.99,
          createdAt: new Date().toISOString(),
        }, { status: 201 });
      }),
    );

    render(
      <Wrapper>
        <WatchlistToggle product={product} entry={undefined} disabled={false} />
      </Wrapper>,
    );

    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(postCalled).toBe(true);
    });
  });

  it('calls DELETE /watchlist/:id when toggled off', async () => {
    let deleteCalled = false;
    server.use(
      http.delete('http://localhost:3000/watchlist/watch-1', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    render(
      <Wrapper>
        <WatchlistToggle product={product} entry={entry} disabled={false} />
      </Wrapper>,
    );

    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });
});
