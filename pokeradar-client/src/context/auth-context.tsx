import { useCallback, useEffect, type ReactNode } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users.api';
import { AuthContext, type AuthContextValue } from './auth-context-value';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, signOut, getToken } = useClerkAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();

  // Warm the token cache as soon as the session is known so the first
  // authenticated API request doesn't pay the cold-path penalty.
  useEffect(() => {
    if (isSignedIn) getToken();
  }, [isSignedIn, getToken]);

  const { isLoading: isProfileLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: usersApi.getProfile,
    enabled: isSignedIn === true,
  });

  const logout = useCallback(async () => {
    queryClient.clear();
    await signOut();
  }, [signOut, queryClient]);

  const value: AuthContextValue = {
    isAuthenticated: isSignedIn === true,
    isLoading: !isLoaded || isSignedIn === undefined || (isSignedIn === true && isProfileLoading),
    user: user
      ? {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress ?? '',
          displayName: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? '',
        }
      : null,
    logout,
    login: () => {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
