import { createContext } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  logout: () => Promise<void>;
  login: (token: string) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
