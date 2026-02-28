import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  to: string;
  label?: string;
}

export function BackButton({ to, label = 'Powrót do listy' }: BackButtonProps) {
  return (
    <Link to={to}>
      <Button variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {label}
      </Button>
    </Link>
  );
}
