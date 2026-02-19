import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ClerkSignInButton } from './sign-in-button';
import { ShieldAlert } from 'lucide-react';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Alert className="max-w-md">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>Wymagane logowanie</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-4">
              Musisz się zalogować, aby uzyskać dostęp do tej strony.
            </p>
            <ClerkSignInButton />
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
