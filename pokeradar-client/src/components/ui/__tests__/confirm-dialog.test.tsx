import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function renderDialog(onConfirm = vi.fn(), isPending?: boolean) {
  return render(
    <ConfirmDialog
      trigger={<Button>Delete</Button>}
      title="Delete item?"
      description="This cannot be undone."
      confirmLabel="Yes, delete"
      isPending={isPending}
      onConfirm={onConfirm}
    />,
  );
}

describe('ConfirmDialog', () => {
  it('renders the trigger', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /Delete/ })).toBeInTheDocument();
  });

  it('does not show dialog content before trigger is clicked', () => {
    renderDialog();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('opens the dialog when trigger is clicked', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /Delete/ }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Delete item?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('calls onConfirm and closes when confirm button is clicked (no async pending)', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    await user.click(screen.getByRole('button', { name: /Delete/ }));
    await user.click(screen.getByRole('button', { name: /Yes, delete/ }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does not call onConfirm when cancelled', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    await user.click(screen.getByRole('button', { name: /Delete/ }));
    await user.click(screen.getByRole('button', { name: /Anuluj/ }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders a custom cancel label', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        trigger={<Button>Open</Button>}
        title="Sure?"
        description="Really?"
        confirmLabel="Go"
        cancelLabel="Nope"
        onConfirm={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Open/ }));
    expect(screen.getByRole('button', { name: /Nope/ })).toBeInTheDocument();
  });

  it('renders the icon when provided', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        trigger={<Button>Open</Button>}
        title="With icon"
        description="Has icon"
        confirmLabel="OK"
        icon={Trash2}
        onConfirm={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Open/ }));
    expect(document.querySelector('[data-slot="alert-dialog-media"]')).toBeInTheDocument();
  });

  it('shows spinner and disables buttons while isPending is true', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ConfirmDialog
        trigger={<Button>Open</Button>}
        title="Delete?"
        description="Sure?"
        confirmLabel="Delete"
        isPending={false}
        onConfirm={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Open/ }));

    rerender(
      <ConfirmDialog
        trigger={<Button>Open</Button>}
        title="Delete?"
        description="Sure?"
        confirmLabel="Delete"
        isPending={true}
        onConfirm={vi.fn()}
      />,
    );

    const confirmBtn = screen.getByRole('button', { name: /Delete/ });
    const cancelBtn = screen.getByRole('button', { name: /Anuluj/ });
    expect(confirmBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('closes the dialog when isPending transitions true → false after confirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        trigger={<Button>Open</Button>}
        title="Delete?"
        description="Sure?"
        confirmLabel="Delete"
        isPending={false}
        onConfirm={onConfirm}
      />,
    );

    // Open the dialog while isPending=false
    await user.click(screen.getByRole('button', { name: /Open/ }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    // Click confirm — sets awaitingSettlement internally, calls onConfirm
    await user.click(screen.getByRole('button', { name: /Delete/ }));
    expect(onConfirm).toHaveBeenCalledOnce();

    // Simulate: parent re-renders with isPending=true (mutation started after confirm)
    await act(async () => {
      rerender(
        <ConfirmDialog
          trigger={<Button>Open</Button>}
          title="Delete?"
          description="Sure?"
          confirmLabel="Delete"
          isPending={true}
          onConfirm={onConfirm}
        />,
      );
    });
    // Dialog should still be open while in flight
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    // Simulate: mutation completes — isPending back to false
    await act(async () => {
      rerender(
        <ConfirmDialog
          trigger={<Button>Open</Button>}
          title="Delete?"
          description="Sure?"
          confirmLabel="Delete"
          isPending={false}
          onConfirm={onConfirm}
        />,
      );
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
