import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/clerk-react';
import { plPL } from '@clerk/localizations';
import { AuthProvider } from '@/context/auth-context';
import { useAuth } from '@/hooks/use-auth';
import App from './App';
import './index.css';
import { theme } from './theme';

function AuthLoadingGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }
  return <>{children}</>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

const clerkAppearance = {
  variables: {
    colorBackground: theme.background,
    colorInputBackground: theme.input,
    colorPrimary: theme.primary,
    colorText: theme.foreground,
    colorTextSecondary: theme.mutedFg,
    colorInputText: theme.foreground,
    colorDanger: theme.destructive,
    borderRadius: theme.radius,
    fontFamily: 'inherit',
    spacingUnit: '1rem',
  },
  elements: {
    card: {
      backgroundColor: theme.card,
      border: `1px solid ${theme.border}`,
      boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
      padding: '1.75rem',
    },
    cardBox: {
      border: 'none',
      boxShadow: 'none',
      backgroundColor: 'transparent',
    },
    headerTitle: {
      color: theme.foreground,
      fontSize: '1.375rem',
      fontWeight: '700',
    },
    headerSubtitle: { color: theme.mutedFg, fontSize: '0.875rem' },
    socialButtonsBlockButton: {
      backgroundColor: theme.border, // needs contrast against card
      border: `1px solid ${theme.borderLight}`,
      color: theme.foreground,
      fontWeight: '500',
      transition: 'background-color 0.15s ease, border-color 0.15s ease',
      '&:hover, &:focus, &:active': {
        backgroundColor: theme.inputHover,
        borderColor: theme.borderLighter,
        boxShadow: 'none',
        transform: 'none',
      },
    },
    socialButtonsBlockButtonText: { color: theme.foreground, fontWeight: '500' },
    dividerLine: { backgroundColor: theme.border },
    dividerText: { color: theme.mutedFg, fontSize: '0.75rem' },
    formFieldLabel: { color: theme.labelFg, fontWeight: '500', fontSize: '0.875rem' },
    formFieldInput: {
      backgroundColor: theme.input,
      border: `1px solid ${theme.border}`,
      color: theme.foreground,
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    },
    formButtonPrimary: {
      backgroundColor: theme.primary,
      color: theme.primaryFg,
      fontWeight: '500',
      fontSize: '0.875rem',
      fontFamily: 'inherit',
      letterSpacing: 'normal',
      textTransform: 'none',
      borderRadius: theme.radiusMd,
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
      transition: 'background-color 0.15s ease',
      '&:hover, &:focus, &:active': {
        backgroundColor: theme.primaryHover,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
        transform: 'none',
      },
    },
    footerActionLink: {
      color: theme.primary,
      fontWeight: '500',
      '&:hover': { color: theme.primaryLight, textDecoration: 'underline' },
    },
    formFieldAction: {
      color: theme.primary,
      '&:hover': { color: theme.primaryLight, textDecoration: 'underline' },
    },
    // Secondary "use another method" button
    alternativeMethodsBlockButton: {
      backgroundColor: theme.border, // needs contrast against card
      border: `1px solid ${theme.borderLight}`,
      color: theme.foreground,
      transition: 'background-color 0.15s ease, border-color 0.15s ease',
      '&:hover, &:focus, &:active': {
        backgroundColor: theme.inputHover,
        borderColor: theme.borderLighter,
        boxShadow: 'none',
        transform: 'none',
      },
    },
    // Back / ghost buttons
    formButtonReset: {
      color: theme.mutedFg,
      transition: 'color 0.15s ease',
      '&:hover': { color: theme.foreground },
    },
    // Error / info alerts
    alertText: { color: theme.destructive },
    // OTP screen
    otpCodeFieldInput: {
      backgroundColor: theme.input,
      border: 'none',
      color: theme.foreground,
    },
    // Identity preview (shows email before OTP)
    identityPreviewText: { color: theme.foreground },
    identityPreviewEditButton: {
      color: theme.primary,
      transition: 'color 0.15s ease',
    },
    modalBackdrop: { backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' },
    lastAuthenticationStrategyBadge: { display: 'none' },
  },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      localization={plPL}
      appearance={clerkAppearance}
      signInForceRedirectUrl="/"
      signUpForceRedirectUrl="/"
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthLoadingGate>
            <App />
          </AuthLoadingGate>
        </AuthProvider>
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
);
