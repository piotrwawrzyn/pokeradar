import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: 'default' | 'destructive';
  icon?: LucideIcon;
  /**
   * Pass the mutation's isPending state to keep the dialog open during the operation
   * and close it automatically once the operation settles.
   * When omitted, the dialog closes immediately on confirm.
   */
  isPending?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Anuluj',
  confirmVariant = 'destructive',
  icon: Icon,
  isPending,
  onConfirm,
}: ConfirmDialogProps) {
  const isAsync = isPending !== undefined;
  const pending = isPending ?? false;

  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Detect pending true → false transition to auto-close after async confirm.
  // Uses the React-recommended render-time setState pattern for derived state:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevPending, setPrevPending] = useState(pending);
  if (prevPending !== pending) {
    setPrevPending(pending);
    if (prevPending && !pending && confirmed) {
      setConfirmed(false);
      setOpen(false);
    }
  }

  const handleConfirm = () => {
    onConfirm();
    if (isAsync) {
      setConfirmed(true);
    } else {
      setOpen(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!pending) {
      setOpen(next);
      if (!next) setConfirmed(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          {Icon && (
            <AlertDialogMedia>
              <Icon />
            </AlertDialogMedia>
          )}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button variant={confirmVariant} disabled={pending} onClick={handleConfirm}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
