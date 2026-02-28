import { Loader2 } from 'lucide-react';

export function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
