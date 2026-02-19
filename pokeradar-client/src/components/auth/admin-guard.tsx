import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useUser } from '@clerk/clerk-react';

export function AdminGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { user, isLoaded } = useUser();

  if (authLoading || !isLoaded) {
    return null;
  }

  const isAdmin = (user?.publicMetadata as any)?.isAdmin === true;

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
