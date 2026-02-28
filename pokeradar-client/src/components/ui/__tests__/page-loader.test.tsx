import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageLoader } from '../page-loader';

describe('PageLoader', () => {
  it('renders a spinner', () => {
    render(<PageLoader />);
    const svg = document.querySelector('.animate-spin');
    expect(svg).toBeInTheDocument();
  });

  it('is not interactive (pointer-events-none)', () => {
    const { container } = render(<PageLoader />);
    expect(container.firstElementChild).toHaveClass('pointer-events-none');
  });
});
