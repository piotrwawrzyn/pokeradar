import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { ClerkSignInButton } from '@/components/auth/sign-in-button';
import { UserMenu } from '@/components/auth/user-menu';

export function Header() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center">
          <img src="/pokeradar.png" alt="pokeradar" className="h-14" />
        </Link>

        <div className="flex items-center gap-3">
          {!isLoading &&
            (isAuthenticated ? <UserMenu /> : <ClerkSignInButton className="h-9 text-sm" />)}
        </div>
      </div>
    </header>
  );
}
