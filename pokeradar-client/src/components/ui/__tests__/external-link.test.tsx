import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExternalLink } from '../external-link';

describe('ExternalLink', () => {
  it('renders children and href', () => {
    render(<ExternalLink href="https://example.com">Click me</ExternalLink>);
    const link = screen.getByText('Click me');
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('opens in new tab with security attributes', () => {
    render(<ExternalLink href="https://example.com">Link</ExternalLink>);
    const link = screen.getByText('Link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('passes className', () => {
    render(
      <ExternalLink href="https://example.com" className="text-blue-500">
        Styled
      </ExternalLink>,
    );
    expect(screen.getByText('Styled')).toHaveClass('text-blue-500');
  });
});
