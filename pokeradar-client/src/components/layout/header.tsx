import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { ClerkSignInButton } from '@/components/auth/sign-in-button';
import { UserMenu } from '@/components/auth/user-menu';

export function Header() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 text-primary">
          <span className="text-xl font-bold tracking-tight">
            pokeradar
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {isLoading ? null : isAuthenticated ? (
            <UserMenu />
          ) : (
            <ClerkSignInButton className="h-9 text-sm" />
          )}
        </div>
      </div>
    </header>
  );
}
