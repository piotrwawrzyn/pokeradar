import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { WatchlistPage } from '@/pages/watchlist-page';

describe('WatchlistPage', () => {
  it('renders the page heading', () => {
    renderWithProviders(<WatchlistPage />);
    expect(screen.getByText(/Nie przegap żadnej okazji/)).toBeInTheDocument();
  });

  it('renders the hero description', () => {
    renderWithProviders(<WatchlistPage />);
    expect(screen.getByText(/Monitorujemy ceny/)).toBeInTheDocument();
  });

  it('renders the product catalog', async () => {
    renderWithProviders(<WatchlistPage />);

    await waitFor(() => {
      expect(screen.getByText('Pikachu VMAX')).toBeInTheDocument();
    });
  });

  it('renders step-by-step instructions', () => {
    renderWithProviders(<WatchlistPage />);
    expect(screen.getByText('Wybierz produkty')).toBeInTheDocument();
    expect(screen.getByText('Ustaw alert cenowy')).toBeInTheDocument();
    expect(screen.getByText('Otrzymuj powiadomienia')).toBeInTheDocument();
  });
});
