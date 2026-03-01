import { useAuth } from '@/hooks/use-auth';
import { useUserProfile } from '@/hooks/use-user-profile';

export type WatchlistState = 'loading' | 'not-logged-in' | 'no-notifications' | 'ready';

export function useWatchlistState(): WatchlistState {
  const { isAuthenticated, isLoading } = useAuth();
  const { data: profile, isLoading: isProfileLoading } = useUserProfile();

  if (isLoading || (isAuthenticated && isProfileLoading)) return 'loading';
  if (!isAuthenticated) return 'not-logged-in';
  if (!profile?.telegram.linked && !profile?.discord.linked) return 'no-notifications';
  return 'ready';
}
