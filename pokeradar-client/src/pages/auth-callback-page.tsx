import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      login(token);
      navigate('/', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [searchParams, login, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="space-y-4 text-center">
        <Skeleton className="h-8 w-48 mx-auto" />
        <p className="text-muted-foreground">Logowanie...</p>
      </div>
    </div>
  );
}
