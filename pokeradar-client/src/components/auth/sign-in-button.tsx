import { SignInButton } from '@clerk/clerk-react';

export function ClerkSignInButton({ className }: { className?: string }) {
  return (
    <SignInButton mode="modal">
      <button
        className={`inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 ${className ?? ''}`}
      >
        Zaloguj się
      </button>
    </SignInButton>
  );
}
