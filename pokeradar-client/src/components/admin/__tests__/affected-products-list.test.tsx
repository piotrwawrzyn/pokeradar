import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AffectedProductsList } from '@/components/admin/affected-products-list';

describe('AffectedProductsList', () => {
  it('renders nothing when products list is empty', () => {
    const { container } = render(<AffectedProductsList products={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders product names', () => {
    render(
      <AffectedProductsList
        products={[
          { id: '1', name: 'Pikachu Box' },
          { id: '2', name: 'Charizard ETB' },
        ]}
      />,
    );
    expect(screen.getByText('Pikachu Box')).toBeInTheDocument();
    expect(screen.getByText('Charizard ETB')).toBeInTheDocument();
  });

  it('renders the warning message', () => {
    render(<AffectedProductsList products={[{ id: '1', name: 'Test' }]} />);
    expect(screen.getByText(/Następujące produkty zostaną usunięte/)).toBeInTheDocument();
    expect(screen.getByText(/watchlisty, powiadomienia/)).toBeInTheDocument();
  });
});
