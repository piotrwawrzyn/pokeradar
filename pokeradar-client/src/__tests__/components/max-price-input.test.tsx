import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('renders slider with the current max price displayed', () => {
    render(
      <Wrapper>
        <MaxPriceInput entryId="watch-1" currentMaxPrice={150} currentBestPrice={179.99} />
      </Wrapper>,
    );

    expect(screen.getByText('Limit cenowy:')).toBeInTheDocument();
    expect(screen.getByText(/150,00/)).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('renders slider element with correct attributes', () => {
    render(
      <Wrapper>
        <MaxPriceInput entryId="watch-1" currentMaxPrice={150} currentBestPrice={179.99} />
      </Wrapper>,
    );

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', '1');
    expect(slider).toHaveAttribute('aria-valuemax', '179.99');
    expect(slider).toHaveAttribute('aria-valuenow', '150');
  });

  it('hides slider visually but reserves space when best price is null', () => {
    render(
      <Wrapper>
        <MaxPriceInput entryId="watch-1" currentMaxPrice={150} currentBestPrice={null} />
      </Wrapper>,
    );

    // Slider is not accessible (hidden from screen readers)
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    // But the tappable price label is still visible
    expect(screen.getByText(/150,00/)).toBeInTheDocument();
  });

  it('extends slider max when saved maxPrice exceeds current best price', () => {
    render(
      <Wrapper>
        <MaxPriceInput entryId="watch-1" currentMaxPrice={1000} currentBestPrice={500} />
      </Wrapper>,
    );

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemax', '1000');
    expect(slider).toHaveAttribute('aria-valuenow', '1000');
  });

  it('opens inline input when clicking the price label', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <MaxPriceInput entryId="watch-1" currentMaxPrice={150} currentBestPrice={179.99} />
      </Wrapper>,
    );

    const priceButton = screen.getByText(/150,00/);
    await user.click(priceButton);

    const input = screen.getByLabelText('Wpisz maksymalną cenę');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(150);
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
