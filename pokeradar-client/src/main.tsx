import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/clerk-react';
import { plPL } from '@clerk/localizations';
import { AuthProvider } from '@/context/auth-context';
import { useAuth } from '@/hooks/use-auth';
import App from './App';
import './index.css';

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

if (import.meta.env.DEV) {
  import('react-grab');
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
    colorBackground: '#18191e',       // oklch(0.16 0.01 260) — app background
    colorInputBackground: '#272830',  // oklch(0.28 0.01 260) — app input
    colorPrimary: '#f0b429',          // oklch(0.82 0.17 85)  — app primary
    colorText: '#f0efec',             // oklch(0.95 0.01 90)  — app foreground
    colorTextSecondary: '#9d9b94',    // oklch(0.65 0.02 90)  — app muted-foreground
    colorInputText: '#f0efec',
    colorDanger: '#f87171',
    borderRadius: '0.625rem',
    fontFamily: 'inherit',
    spacingUnit: '1rem',
  },
  elements: {
    card: {
      backgroundColor: '#1d1e24',    // oklch(0.20 0.01 260) — app card
      border: '1px solid #2b2c34',   // oklch(0.30 0.01 260) — app border
      boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
      padding: '1.75rem',
    },
    cardBox: {
      border: 'none',
      boxShadow: 'none',
      backgroundColor: 'transparent',
    },
    headerTitle: {
      color: '#f0efec',
      fontSize: '1.375rem',
      fontWeight: '700',
    },
    headerSubtitle: { color: '#9d9b94', fontSize: '0.875rem' },
    socialButtonsBlockButton: {
      backgroundColor: '#272830',    // oklch(0.28 0.01 260) — app input
      border: '1px solid #2b2c34',   // oklch(0.30 0.01 260) — app border
      color: '#f0efec',
      fontWeight: '500',
      transition: 'background-color 0.15s ease',
    },
    socialButtonsBlockButtonText: { color: '#f0efec', fontWeight: '500' },
    dividerLine: { backgroundColor: '#2b2c34' },
    dividerText: { color: '#6b7280', fontSize: '0.75rem' },
    formFieldLabel: { color: '#c9c7c0', fontWeight: '500', fontSize: '0.875rem' },
    formFieldInput: {
      backgroundColor: '#272830',    // oklch(0.28 0.01 260) — app input
      border: '1px solid #2b2c34',   // oklch(0.30 0.01 260) — app border
      color: '#f0efec',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    },
    formButtonPrimary: {
      backgroundColor: '#f0b429',
      color: '#181a2a',
      fontWeight: '500',
      fontSize: '0.875rem',
      fontFamily: 'inherit',
      letterSpacing: 'normal',
      textTransform: 'none',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
      transition: 'background-color 0.15s ease',
    },
    footerActionLink: { color: '#f0b429', fontWeight: '500' },
    formFieldAction: { color: '#f0b429' },
    // Secondary "use another method" button
    alternativeMethodsBlockButton: {
      backgroundColor: '#272830',
      border: '1px solid #2b2c34',
      color: '#f0efec',
      transition: 'background-color 0.15s ease',
    },
    // Back / ghost buttons
    formButtonReset: {
      color: '#9d9b94',
      transition: 'color 0.15s ease',
    },
    // Error / info alerts
    alertText: { color: '#f87171' },
    // OTP screen
    otpCodeFieldInput: {
      backgroundColor: '#272830',
      border: 'none',
      color: '#f0efec',
    },
    // Identity preview (shows email before OTP)
    identityPreviewText: { color: '#f0efec' },
    identityPreviewEditButton: {
      color: '#f0b429',
      transition: 'color 0.15s ease',
    },
    modalBackdrop: { backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' },
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
