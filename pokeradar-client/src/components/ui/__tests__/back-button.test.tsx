import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { BackButton } from '../back-button';

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('BackButton', () => {
  it('renders with default label', () => {
    renderWithRouter(<BackButton to="/admin/users" />);
    expect(screen.getByText('Powrót do listy')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    renderWithRouter(<BackButton to="/admin/shops" label="Go back" />);
    expect(screen.getByText('Go back')).toBeInTheDocument();
  });

  it('links to the correct path', () => {
    renderWithRouter(<BackButton to="/admin/users" />);
    const link = screen.getByText('Powrót do listy').closest('a');
    expect(link).toHaveAttribute('href', '/admin/users');
  });
});
