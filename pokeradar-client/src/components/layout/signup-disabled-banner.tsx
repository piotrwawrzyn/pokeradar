import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { authApi } from '@/api/auth.api';
import { useAuth } from '@/hooks/use-auth';

export function SignupDisabledBanner() {
  const { isAuthenticated } = useAuth();

  const { data } = useQuery({
    queryKey: ['signup-status'],
    queryFn: authApi.getSignupStatus,
    enabled: !isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  if (isAuthenticated || !data) return null;

  const message = !data.loginEnabled
    ? 'Logowanie jest tymczasowo wyłączone.'
    : !data.signupsEnabled
      ? 'Rejestracja nowych kont jest tymczasowo wstrzymana.'
      : null;

  if (!message) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <p className="inline-flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0" />
        {message}
      </p>
    </div>
  );
}
