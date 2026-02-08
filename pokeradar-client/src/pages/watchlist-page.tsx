import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ProductCatalog } from '@/components/products/product-catalog';
import pikachuImg from '@/assets/pikachu.png';

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
      <div className="relative mb-6 overflow-hidden rounded-xl bg-card">
        <div className="flex items-end gap-5">
          <div className="flex-1 min-w-0 px-5 py-5 sm:px-6 sm:py-6">
            <h1 className="text-lg font-bold sm:text-xl tracking-tight">
              Pokeradar sprawdza ceny Pokémon TCG za Ciebie
            </h1>
            <div className="text-muted-foreground mt-2 text-xs sm:text-sm leading-relaxed space-y-1.5">
              <p>
                Pokeradar na bieżąco sprawdza ceny tych samych produktów Pokémon TCG
                w <span className="text-foreground font-medium">ponad 50 sklepach</span> w Polsce.
              </p>
              <p>
                Ty po prostu wybierasz, co Cię interesuje i ile maksymalnie chcesz zapłacić.
              </p>
              <p>
                Gdy gdzieś pojawi się dobra oferta, wiesz o tym od razu
                — bez odświeżania stron, bez porównywarek i bez przegapionych okazji.
              </p>
            </div>
          </div>
          <img
            src={pikachuImg}
            alt="Pikachu"
            className="hidden sm:block h-36 w-36 object-contain flex-shrink-0 mr-4 self-end"
          />
        </div>
      </div>
      <ProductCatalog />
    </div>
  );
}
