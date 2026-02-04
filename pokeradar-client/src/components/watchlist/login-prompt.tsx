import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Info, Bell } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useUserProfile } from '@/hooks/use-user-profile';

type WatchlistState = 'not-logged-in' | 'no-notifications' | 'ready';

export function useWatchlistState(): WatchlistState {
  const { isAuthenticated } = useAuth();
  const { data: profile } = useUserProfile();

  if (!isAuthenticated) return 'not-logged-in';
  if (!profile?.telegramLinked) return 'no-notifications';
  return 'ready';
}

export function WatchlistBanner() {
  const state = useWatchlistState();

  if (state === 'ready') return null;

  if (state === 'not-logged-in') {
    return (
      <Alert className="mb-6 border-primary/30 bg-primary/5">
        <Info className="h-5 w-5 text-primary" />
        <AlertTitle>Lista obserwowanych</AlertTitle>
        <AlertDescription className="mt-2">
          Zaloguj się, aby skonfigurować swoją listę obserwowanych i otrzymywać
          powiadomienia o zmianach cen.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-6 border-amber-500/30 bg-amber-500/5">
      <Bell className="h-5 w-5 text-amber-500" />
      <AlertTitle>Skonfiguruj powiadomienia</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-1">
          Aby korzystać z listy obserwowanych, najpierw skonfiguruj powiadomienia.
        </p>
        <p className="text-muted-foreground text-sm mb-3">
          Bez aktywnego kanału powiadomień nie będziemy mogli informować Cię o
          zmianach cen.
        </p>
        <Button asChild size="sm">
          <Link to="/ustawienia">Przejdź do ustawień</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
