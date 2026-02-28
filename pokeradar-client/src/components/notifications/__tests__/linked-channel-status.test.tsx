import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkedChannelStatus } from '@/components/notifications/linked-channel-status';

describe('LinkedChannelStatus', () => {
  it('renders channel name', () => {
    render(<LinkedChannelStatus channelName="Telegram" isPending={false} onUnlink={vi.fn()} />);
    expect(screen.getByText(/Telegram/)).toBeInTheDocument();
  });

  it('calls onUnlink when button is clicked', () => {
    const onUnlink = vi.fn();
    render(<LinkedChannelStatus channelName="Discord" isPending={false} onUnlink={onUnlink} />);
    fireEvent.click(screen.getByRole('button', { name: /Odłącz/ }));
    expect(onUnlink).toHaveBeenCalledOnce();
  });

  it('disables button when isPending', () => {
    render(<LinkedChannelStatus channelName="Telegram" isPending={true} onUnlink={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Odłącz/ })).toBeDisabled();
  });
});
