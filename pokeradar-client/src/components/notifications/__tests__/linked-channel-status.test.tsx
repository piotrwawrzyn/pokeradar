import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkedChannelStatus } from '@/components/notifications/linked-channel-status';

describe('LinkedChannelStatus', () => {
  it('renders channel name', () => {
    render(<LinkedChannelStatus channelName="Telegram" isPending={false} onUnlink={vi.fn()} />);
    expect(screen.getByText(/Telegram/)).toBeInTheDocument();
  });

  it('calls onUnlink when button is clicked (no confirmation needed)', () => {
    const onUnlink = vi.fn();
    render(<LinkedChannelStatus channelName="Discord" isPending={false} onUnlink={onUnlink} />);
    fireEvent.click(screen.getByRole('button', { name: /Odłącz/ }));
    expect(onUnlink).toHaveBeenCalledOnce();
  });

  it('disables button when isPending', () => {
    render(<LinkedChannelStatus channelName="Telegram" isPending={true} onUnlink={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Odłącz/ })).toBeDisabled();
  });

  it('does not show dialog when isLastChannel is false', () => {
    const onUnlink = vi.fn();
    render(
      <LinkedChannelStatus
        channelName="Telegram"
        isPending={false}
        onUnlink={onUnlink}
        isLastChannel={false}
        watchlistCount={3}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Odłącz/ }));
    expect(onUnlink).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does not show dialog when watchlistCount is 0', () => {
    const onUnlink = vi.fn();
    render(
      <LinkedChannelStatus
        channelName="Telegram"
        isPending={false}
        onUnlink={onUnlink}
        isLastChannel={true}
        watchlistCount={0}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Odłącz/ }));
    expect(onUnlink).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows confirmation dialog when isLastChannel and watchlistCount > 0', async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    render(
      <LinkedChannelStatus
        channelName="Telegram"
        isPending={false}
        onUnlink={onUnlink}
        isLastChannel={true}
        watchlistCount={2}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Odłącz/ }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/To jedyny skonfigurowany kanał/)).toBeInTheDocument();
    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(onUnlink).not.toHaveBeenCalled();
  });

  it('calls onUnlink when confirmation dialog is confirmed', async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    render(
      <LinkedChannelStatus
        channelName="Discord"
        isPending={false}
        onUnlink={onUnlink}
        isLastChannel={true}
        watchlistCount={5}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Odłącz/ }));
    await user.click(screen.getByRole('button', { name: /Odłącz i wyczyść/ }));
    expect(onUnlink).toHaveBeenCalledOnce();
  });

  it('does not call onUnlink when dialog is cancelled', async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    render(
      <LinkedChannelStatus
        channelName="Telegram"
        isPending={false}
        onUnlink={onUnlink}
        isLastChannel={true}
        watchlistCount={1}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Odłącz/ }));
    await user.click(screen.getByRole('button', { name: /Anuluj/ }));
    expect(onUnlink).not.toHaveBeenCalled();
  });
});
