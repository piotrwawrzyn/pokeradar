import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ProductCatalog } from '@/components/products/product-catalog';
import { server } from '../../../__tests__/mocks/server';
import { http, HttpResponse } from 'msw';

describe('ProductCatalog', () => {
  it('shows loading skeletons while data is being fetched', () => {
    server.use(
      http.get('http://localhost:3000/products', async () => {
        // Never resolves — keeps the component in loading state for the duration of this test
        await new Promise<never>(() => {});
      }),
    );

    const { container } = renderWithProviders(<ProductCatalog />);
    // Skeleton elements should be present immediately while the query is in flight
    const skeletons = container.querySelectorAll('[class*="skeleton"], [data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders products grouped by set', async () => {
    renderWithProviders(<ProductCatalog />);

    await waitFor(() => {
      expect(screen.getByText('Scarlet & Violet')).toBeInTheDocument();
    });

    expect(screen.getByText('Sword & Shield')).toBeInTheDocument();
    expect(screen.getByText('Pikachu VMAX')).toBeInTheDocument();
    expect(screen.getByText('Charizard EX')).toBeInTheDocument();
    expect(screen.getByText('Mewtwo GX')).toBeInTheDocument();
  });

  it('shows "Inne" group for products without a set', async () => {
    renderWithProviders(<ProductCatalog />);

    await waitFor(() => {
      expect(screen.getByText('Inne')).toBeInTheDocument();
    });

    // Eevee Promo has no productSetId
    expect(screen.getByText('Eevee Promo')).toBeInTheDocument();
  });

  it('sorts sets by release date descending (newest first)', async () => {
    renderWithProviders(<ProductCatalog />);

    await waitFor(() => {
      expect(screen.getByText('Scarlet & Violet')).toBeInTheDocument();
    });

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .filter((el) => el.textContent?.includes('Scarlet') || el.textContent?.includes('Sword'));

    // Scarlet & Violet (2024-01-15) should appear before Sword & Shield (2023-06-01)
    expect(headings.length).toBeGreaterThanOrEqual(2);
    const svIndex = headings.findIndex((h) => h.textContent?.includes('Scarlet'));
    const swshIndex = headings.findIndex((h) => h.textContent?.includes('Sword'));
    expect(svIndex).toBeLessThan(swshIndex);
  });

  it('shows empty state when no products', async () => {
    server.use(
      http.get('http://localhost:3000/products', () => {
        return HttpResponse.json([]);
      }),
      http.get('http://localhost:3000/product-sets', () => {
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(<ProductCatalog />);

    await waitFor(() => {
      expect(screen.getByText('Brak produktów do wyświetlenia.')).toBeInTheDocument();
    });
  });
});
