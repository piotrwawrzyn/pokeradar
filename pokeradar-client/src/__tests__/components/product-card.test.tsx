import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '@/context/auth-context';
import { ProductCard } from '@/components/products/product-card';
import { mockProducts, mockWatchlist, mockUser } from '../mocks/data';
import type { ReactNode } from 'react';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
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

describe('ProductCard', () => {
  const product = mockProducts[0]; // Pikachu VMAX, price 179.99
  const entry = mockWatchlist[0]; // watched, maxPrice 150

  it('renders product name and image', () => {
    render(
      <Wrapper>
        <ProductCard product={product} entry={undefined} watchlistDisabled={false} />
      </Wrapper>,
    );
    expect(screen.getByText('Pikachu VMAX')).toBeInTheDocument();
    expect(screen.getByAltText('Pikachu VMAX')).toBeInTheDocument();
  });

  it('displays formatted price when available', () => {
    render(
      <Wrapper>
        <ProductCard product={product} entry={undefined} watchlistDisabled={false} />
      </Wrapper>,
    );
    // Should contain the price number
    expect(screen.getByText(/179,99/)).toBeInTheDocument();
  });

  it('displays "Brak ceny" when price is null', () => {
    const noPriceProduct = mockProducts[2]; // Mewtwo GX, null price
    render(
      <Wrapper>
        <ProductCard product={noPriceProduct} entry={undefined} watchlistDisabled={false} />
      </Wrapper>,
    );
    expect(screen.getByText('Brak ceny')).toBeInTheDocument();
  });

  it('shows shop name when available', () => {
    render(
      <Wrapper>
        <ProductCard product={product} entry={undefined} watchlistDisabled={false} />
      </Wrapper>,
    );
    expect(screen.getByText('shop-a')).toBeInTheDocument();
  });

  it('shows "Niedostepny" badge for disabled products', () => {
    const disabledProduct = mockProducts[4]; // Retired Booster, disabled=true
    render(
      <Wrapper>
        <ProductCard product={disabledProduct} entry={undefined} watchlistDisabled={false} />
      </Wrapper>,
    );
    expect(screen.getByText('Niedostepny')).toBeInTheDocument();
  });

  it('shows MaxPriceInput when product is watched', () => {
    render(
      <Wrapper>
        <ProductCard product={product} entry={entry} watchlistDisabled={false} />
      </Wrapper>,
    );
    expect(screen.getByLabelText('Maksymalna cena')).toBeInTheDocument();
  });

  it('does not show MaxPriceInput when product is not watched', () => {
    render(
      <Wrapper>
        <ProductCard product={product} entry={undefined} watchlistDisabled={false} />
      </Wrapper>,
    );
    expect(screen.queryByLabelText('Maksymalna cena')).not.toBeInTheDocument();
  });

  it('shows offer link when product is watched and has URL', () => {
    render(
      <Wrapper>
        <ProductCard product={product} entry={entry} watchlistDisabled={false} />
      </Wrapper>,
    );
    const link = screen.getByText('Zobacz oferte');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://shop-a.com/pikachu');
  });

  it('has a watchlist toggle with correct aria-label', () => {
    render(
      <Wrapper>
        <ProductCard product={product} entry={undefined} watchlistDisabled={false} />
      </Wrapper>,
    );
    expect(screen.getByRole('switch', { name: /Obserwuj Pikachu VMAX/ })).toBeInTheDocument();
  });
});
