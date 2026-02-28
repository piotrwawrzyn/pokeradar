import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CopyTokenBox } from '@/components/notifications/copy-token-box';

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}));

describe('CopyTokenBox', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.stubGlobal('navigator', { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the token', () => {
    render(<CopyTokenBox token="abc123" />);
    expect(screen.getByText('abc123')).toBeInTheDocument();
  });

  it('copies token to clipboard on button click', async () => {
    render(<CopyTokenBox token="mytoken" />);
    fireEvent.click(screen.getByRole('button'));
    expect(writeText).toHaveBeenCalledWith('mytoken');
  });
});
