import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteRowButton } from '../delete-row-button';

describe('DeleteRowButton', () => {
  it('renders a button with trash icon', () => {
    render(<DeleteRowButton onClick={() => {}} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<DeleteRowButton onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('stops event propagation', async () => {
    const onClick = vi.fn();
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <DeleteRowButton onClick={onClick} />
      </div>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
    expect(parentClick).not.toHaveBeenCalled();
  });
});
