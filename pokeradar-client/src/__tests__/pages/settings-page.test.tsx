import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '@/context/auth-context';
import { SettingsPage } from '@/pages/settings-page';
import { mockUser } from '../mocks/data';
import type { ReactNode } from 'react';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function makeWrapper(authenticated: boolean) {
  const authValue = {
    user: authenticated
      ? { id: mockUser.id, email: mockUser.email, displayName: mockUser.displayName }
      : null,
    isAuthenticated: authenticated,
    isLoading: false,
    login: () => {},
    logout: async () => {},
  };
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={createQueryClient()}>
        <AuthContext.Provider value={authValue}>
          <BrowserRouter>{children}</BrowserRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
  };
}

describe('SettingsPage', () => {
  it('shows auth guard for unauthenticated users', async () => {
    render(<SettingsPage />, { wrapper: makeWrapper(false) });

    await waitFor(() => {
      expect(screen.getByText(/Wymagane logowanie/)).toBeInTheDocument();
    });
  });

  it('shows settings content for authenticated users', async () => {
    render(<SettingsPage />, { wrapper: makeWrapper(true) });

    await waitFor(() => {
      expect(screen.getByText('Ustawienia')).toBeInTheDocument();
    });
    expect(screen.getByText('Profil')).toBeInTheDocument();
    expect(screen.getByText('Powiadomienia')).toBeInTheDocument();
  });

  it('shows user profile info', async () => {
    render(<SettingsPage />, { wrapper: makeWrapper(true) });

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('shows notification channels section', async () => {
    render(<SettingsPage />, { wrapper: makeWrapper(true) });

    await waitFor(() => {
      expect(screen.getByText('Telegram')).toBeInTheDocument();
    });
  });
});
