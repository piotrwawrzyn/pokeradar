import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface NotFoundProps {
  message: string;
  backTo: string;
}

export function NotFound({ message, backTo }: NotFoundProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{message}</h1>
      <Link to={backTo}>
        <Button variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Powrót
        </Button>
      </Link>
    </div>
  );
}
