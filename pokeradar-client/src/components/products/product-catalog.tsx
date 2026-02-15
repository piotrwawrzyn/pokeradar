import { useMemo } from 'react';
import { useProducts } from '@/hooks/use-products';
import { useProductSets } from '@/hooks/use-product-sets';
import { useWatchlist } from '@/hooks/use-watchlist';
import { useWatchlistState, WatchlistBanner } from '@/components/watchlist/login-prompt';
import { ProductSetGroup } from './product-set-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { Product, ProductSet, WatchlistEntry } from '@/types';

interface GroupedProducts {
  set: ProductSet | null;
  products: Product[];
}

function groupAndSort(
  products: Product[],
  sets: ProductSet[],
): GroupedProducts[] {
  const setMap = new Map(sets.map((s) => [s.id, s]));
  const groups = new Map<string, Product[]>();

  for (const product of products) {
    const key = product.productSetId ?? '__other__';
    const group = groups.get(key);
    if (group) {
      group.push(product);
    } else {
      groups.set(key, [product]);
    }
  }

  const result: GroupedProducts[] = [];
  let otherGroup: GroupedProducts | null = null;

  for (const [key, groupProducts] of groups) {
    if (key === '__other__') {
      otherGroup = { set: null, products: groupProducts };
    } else {
      const set = setMap.get(key) ?? null;
      result.push({ set, products: groupProducts });
    }
  }

  // Sort by release date descending (newest first), sets without date at end
  result.sort((a, b) => {
    const dateA = a.set?.releaseDate ? new Date(a.set.releaseDate).getTime() : 0;
    const dateB = b.set?.releaseDate ? new Date(b.set.releaseDate).getTime() : 0;
    return dateB - dateA;
  });

  // "Inne" category always last
  if (otherGroup) {
    result.push(otherGroup);
  }

  return result;
}

export function ProductCatalog() {
  const { data: products, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useProducts();
  const { data: sets, isLoading: setsLoading, isError: setsError, refetch: refetchSets } = useProductSets();
  const { data: watchlist } = useWatchlist();
  const watchlistState = useWatchlistState();

  const watchlistMap = useMemo(() => {
    const map = new Map<string, WatchlistEntry>();
    if (watchlist) {
      for (const entry of watchlist) {
        map.set(entry.productId, entry);
      }
    }
    return map;
  }, [watchlist]);

  const groups = useMemo(
    () => groupAndSort(products ?? [], sets ?? []),
    [products, sets],
  );

  const isLoading = productsLoading || setsLoading;
  const isError = productsError || setsError;

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-14 w-full rounded-lg" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-64 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto mt-8">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle>Błąd ładowania</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">
            Nie udało się załadować listy produktów. Sprawdź połączenie z
            internetem i spróbuj ponownie.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchProducts();
              refetchSets();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Spróbuj ponownie
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const watchlistDisabled = watchlistState !== 'ready';

  return (
    <div className="space-y-6">
      <WatchlistBanner />
      {groups.map((group) => (
        <ProductSetGroup
          key={group.set?.id ?? '__other__'}
          set={group.set}
          products={group.products}
          watchlistMap={watchlistMap}
          watchlistDisabled={watchlistDisabled}
        />
      ))}
      {groups.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          Brak produktów do wyświetlenia.
        </p>
      )}
    </div>
  );
}
