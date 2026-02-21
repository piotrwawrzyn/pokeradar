import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ProductCatalog } from '@/components/products/product-catalog';
import { ListPlus, Target, BellRing } from 'lucide-react';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  signups_disabled: 'Rejestracja nowych kont jest tymczasowo wstrzymana',
  login_disabled: 'Logowanie jest tymczasowo wyłączone',
  auth_failed: 'Logowanie nie powiodło się. Spróbuj ponownie.',
};

export function WatchlistPage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const authError = (location.state as { authError?: string } | null)?.authError;
    if (authError) {
      toast.error(AUTH_ERROR_MESSAGES[authError] ?? 'Wystąpił błąd logowania');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  return (
    <div>
      <div className="relative mb-6 overflow-hidden rounded-xl bg-card px-6 py-6 sm:px-8 sm:py-8 border border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative">
          <h1 className="text-xl font-bold sm:text-2xl tracking-tight text-foreground">
            Nie przegap żadnej okazji na <span className="text-primary">Pokémon TCG</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-sm sm:text-base leading-relaxed">
            Monitorujemy ceny w{' '}
            <span className="text-foreground font-semibold">ponad 100 polskich sklepach</span> i
            wysyłamy
            <span className="text-foreground font-semibold"> natychmiastowe powiadomienia</span>.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ListPlus className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Wybierz produkty</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Dodaj pokemony do prywatnej watchlisty
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Ustaw alert cenowy</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Określ maksymalną kwotę, jaką chcesz zapłacić
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BellRing className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Otrzymuj powiadomienia</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Dowiedz się natychmiast, gdy pojawi się okazja
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ProductCatalog />
    </div>
  );
}
