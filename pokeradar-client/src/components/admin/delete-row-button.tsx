import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface DeleteRowButtonProps {
  onClick: () => void;
}

export function DeleteRowButton({ onClick }: DeleteRowButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Trash2 className="h-4 w-4 text-red-500" />
    </Button>
  );
}
