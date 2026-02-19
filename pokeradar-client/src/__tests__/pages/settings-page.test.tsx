import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '@/context/auth-context';
import { SettingsPage } from '@/pages/settings-page';
import { mockUser } from '../mocks/data';
import { renderWithProviders } from '../test-utils';
import type { ReactNode } from 'react';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function AuthenticatedWrapper({ children }: { children: ReactNode }) {
  const authValue = {
    token: 'test',
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    login: () => {},
    logout: async () => {},
  };
  return (
    <QueryClientProvider client={createQueryClient()}>
      <AuthContext.Provider value={authValue}>
        <BrowserRouter>{children}</BrowserRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

describe('SettingsPage', () => {
  it('shows auth guard for unauthenticated users', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      // AuthGuard renders a login prompt
      expect(screen.getByText(/Zaloguj/)).toBeInTheDocument();
    });
  });

  it('shows settings content for authenticated users', async () => {
    render(<SettingsPage />, { wrapper: AuthenticatedWrapper });

    await waitFor(() => {
      expect(screen.getByText('Ustawienia')).toBeInTheDocument();
    });
    expect(screen.getByText('Profil')).toBeInTheDocument();
    expect(screen.getByText('Powiadomienia')).toBeInTheDocument();
  });

  it('shows user profile info', async () => {
    render(<SettingsPage />, { wrapper: AuthenticatedWrapper });

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('shows notification channels section', async () => {
    render(<SettingsPage />, { wrapper: AuthenticatedWrapper });

    await waitFor(() => {
      expect(screen.getByText('Telegram')).toBeInTheDocument();
    });
  });
});
