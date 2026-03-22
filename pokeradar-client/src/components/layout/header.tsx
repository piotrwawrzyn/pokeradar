import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { ClerkSignInButton } from '@/components/auth/sign-in-button';
import { UserMenu } from '@/components/auth/user-menu';

export function Header() {
  const { isAuthenticated, isLoading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled((prev) => {
        if (prev) return window.scrollY > 10;
        return window.scrollY > 50;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background backdrop-blur transition-all duration-300">
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between px-4 transition-all duration-300 sm:px-6 lg:px-8 ${scrolled ? 'h-14' : 'h-20'}`}
      >
        <Link to="/" className="flex items-center">
          <img
            src="/pokeradar.png"
            alt="pokeradar"
            className={`transition-all duration-300 ${scrolled ? 'h-12' : 'h-16'}`}
          />
        </Link>

        <div className="flex items-center gap-3">
          {!isLoading &&
            (isAuthenticated ? <UserMenu /> : <ClerkSignInButton className="h-9 text-sm" />)}
        </div>
      </div>
    </header>
  );
}
