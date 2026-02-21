import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { WatchlistPage } from '@/pages/watchlist-page';

describe('WatchlistPage', () => {
  it('renders the page heading', () => {
    renderWithProviders(<WatchlistPage />);
    expect(screen.getByText('Katalog produktow')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    renderWithProviders(<WatchlistPage />);
    expect(screen.getByText(/Przegladaj produkty Pokemon TCG/)).toBeInTheDocument();
  });

  it('renders the product catalog', async () => {
    renderWithProviders(<WatchlistPage />);

    await waitFor(() => {
      expect(screen.getByText('Pikachu VMAX')).toBeInTheDocument();
    });
  });

  it('shows login prompt for unauthenticated users', async () => {
    renderWithProviders(<WatchlistPage />);

    await waitFor(() => {
      // AuthProvider without a token = not logged in
      expect(screen.getByText(/Zaloguj sie/)).toBeInTheDocument();
    });
  });
});
