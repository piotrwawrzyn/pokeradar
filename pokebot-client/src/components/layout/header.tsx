import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { GoogleLoginButton } from '@/components/auth/google-login-button';
import { UserMenu } from '@/components/auth/user-menu';
import { Zap } from 'lucide-react';

export function Header() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 text-primary">
          <Zap className="h-7 w-7 fill-primary" />
          <span className="text-xl font-bold tracking-tight">
            Pokebot
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {isLoading ? null : isAuthenticated ? (
            <UserMenu />
          ) : (
            <GoogleLoginButton className="h-9 text-sm" />
          )}
        </div>
      </div>
    </header>
  );
}
