import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface SaveButtonProps {
  onClick: () => void;
  isPending: boolean;
}

export function SaveButton({ onClick, isPending }: SaveButtonProps) {
  return (
    <Button onClick={onClick} disabled={isPending}>
      {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
      {isPending ? 'Zapisywanie...' : 'Zapisz'}
    </Button>
  );
}
