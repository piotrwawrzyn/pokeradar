import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/__tests__/test-utils';
import { Header } from '../header';

describe('Header', () => {
  it('renders the logo linking to home', () => {
    renderWithProviders(<Header />);

    const logo = screen.getByAltText('pokeradar');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/pokeradar.png');
    expect(logo.closest('a')).toHaveAttribute('href', '/');
  });

  it('renders the logo with fixed size', () => {
    renderWithProviders(<Header />);

    const logo = screen.getByAltText('pokeradar');
    expect(logo.className).toContain('h-14');
  });
});
