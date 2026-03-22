import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/__tests__/test-utils';
import { Header } from '../header';

describe('Header', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  });

  it('renders the logo linking to home', () => {
    renderWithProviders(<Header />);

    const logo = screen.getByAltText('pokeradar');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/pokeradar.png');
    expect(logo.closest('a')).toHaveAttribute('href', '/');
  });

  it('renders full-size logo at the top of the page', () => {
    renderWithProviders(<Header />);

    const logo = screen.getByAltText('pokeradar');
    expect(logo.className).toContain('h-16');
    expect(logo.className).not.toContain('h-12');
  });

  it('shrinks the logo after scrolling past threshold', () => {
    renderWithProviders(<Header />);

    Object.defineProperty(window, 'scrollY', { value: 60, writable: true, configurable: true });
    fireEvent.scroll(window);

    const logo = screen.getByAltText('pokeradar');
    expect(logo.className).toContain('h-12');
  });

  it('expands the logo back when scrolling near the top', () => {
    renderWithProviders(<Header />);

    Object.defineProperty(window, 'scrollY', { value: 60, writable: true, configurable: true });
    fireEvent.scroll(window);

    Object.defineProperty(window, 'scrollY', { value: 5, writable: true, configurable: true });
    fireEvent.scroll(window);

    const logo = screen.getByAltText('pokeradar');
    expect(logo.className).toContain('h-16');
  });

  it('does not flicker at hysteresis boundary', () => {
    renderWithProviders(<Header />);

    // Scroll past the shrink threshold
    Object.defineProperty(window, 'scrollY', { value: 60, writable: true, configurable: true });
    fireEvent.scroll(window);

    const logo = screen.getByAltText('pokeradar');
    expect(logo.className).toContain('h-12');

    // Scroll back to 15px — above expand threshold (10px), should stay small
    Object.defineProperty(window, 'scrollY', { value: 15, writable: true, configurable: true });
    fireEvent.scroll(window);
    expect(logo.className).toContain('h-12');
  });

  it('shrinks the header container when scrolled', () => {
    renderWithProviders(<Header />);

    const container = screen.getByAltText('pokeradar').closest('a')!.parentElement!;
    expect(container.className).toContain('h-20');

    Object.defineProperty(window, 'scrollY', { value: 60, writable: true, configurable: true });
    fireEvent.scroll(window);
    expect(container.className).toContain('h-14');
  });
});
