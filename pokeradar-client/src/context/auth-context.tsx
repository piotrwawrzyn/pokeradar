import { createContext, useCallback, type ReactNode } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import { useQueryClient } from '@tanstack/react-query';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  telegramLinked: boolean;
  telegramLinkToken: string | null;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  logout: () => Promise<void>;
  login: (token: string) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, signOut } = useClerkAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();

  const logout = useCallback(async () => {
    queryClient.clear();
    await signOut();
  }, [signOut, queryClient]);

  const value: AuthContextValue = {
    isAuthenticated: isSignedIn ?? false,
    isLoading: !isLoaded,
    user: user
      ? {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress ?? '',
          displayName:
            user.fullName ?? user.primaryEmailAddress?.emailAddress ?? '',
          telegramLinked: false,
          telegramLinkToken: null,
        }
      : null,
    logout,
    login: (_token: string) => {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
