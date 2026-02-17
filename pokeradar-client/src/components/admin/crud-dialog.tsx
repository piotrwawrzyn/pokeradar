import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SaveButton } from './save-button';

interface CrudDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEdit: boolean;
  entityLabel: string;
  isPending: boolean;
  onSave: () => void;
  className?: string;
  children: React.ReactNode;
}

export function CrudDialog({
  open,
  onOpenChange,
  isEdit,
  entityLabel,
  isPending,
  onSave,
  className,
  children,
}: CrudDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edytuj ${entityLabel}` : `Nowy ${entityLabel}`}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Zaktualizuj informacje o ${entityLabel}`
              : `Dodaj nowy ${entityLabel} do systemu`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <SaveButton onClick={onSave} isPending={isPending} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
