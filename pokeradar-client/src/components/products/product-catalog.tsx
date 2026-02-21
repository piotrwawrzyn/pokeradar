import { useMemo, useState } from 'react';
import { useProducts } from '@/hooks/use-products';
import { useProductSets } from '@/hooks/use-product-sets';
import { useWatchlist } from '@/hooks/use-watchlist';
import { useWatchlistState, WatchlistBanner } from '@/components/watchlist/login-prompt';
import { useAuth } from '@/hooks/use-auth';
import { ProductSetGroup } from './product-set-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, FilterX, RefreshCw, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product, ProductSet, WatchlistEntry } from '@/types';

interface GroupedProducts {
  set: ProductSet | null;
  products: Product[];
}

function groupAndSort(products: Product[], sets: ProductSet[]): GroupedProducts[] {
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

  // Sort products within each group: available currently first (alphabetically), then unavailable (alphabetically)
  const sortProducts = (products: Product[]) => {
    return products.sort((a, b) => {
      // First, sort by current availability (products with price/shop first)
      const aAvailable = a.currentBestPrice !== null;
      const bAvailable = b.currentBestPrice !== null;
      if (aAvailable !== bAvailable) {
        return bAvailable ? 1 : -1;
      }
      // Then sort alphabetically by name
      return a.name.localeCompare(b.name, 'pl');
    });
  };

  const result: GroupedProducts[] = [];
  let otherGroup: GroupedProducts | null = null;

  for (const [key, groupProducts] of groups) {
    const sortedProducts = sortProducts(groupProducts);
    if (key === '__other__') {
      otherGroup = { set: null, products: sortedProducts };
    } else {
      const set = setMap.get(key) ?? null;
      result.push({ set, products: sortedProducts });
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
  const {
    data: products,
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useProducts();
  const {
    data: sets,
    isLoading: setsLoading,
    isError: setsError,
    refetch: refetchSets,
  } = useProductSets();
  const { data: watchlist } = useWatchlist();
  const watchlistState = useWatchlistState();
  const { isAuthenticated } = useAuth();

  // Filter state
  const [searchText, setSearchText] = useState('');
  const [selectedSetFilter, setSelectedSetFilter] = useState<string>('all');
  const [showOnlyWatched, setShowOnlyWatched] = useState(false);

  const watchlistMap = useMemo(() => {
    const map = new Map<string, WatchlistEntry>();
    if (watchlist) {
      for (const entry of watchlist) {
        map.set(entry.productId, entry);
      }
    }
    return map;
  }, [watchlist]);

  const groups = useMemo(() => {
    let filteredProducts = products ?? [];

    // Text search filter (fuzzy/partial match on product name)
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      filteredProducts = filteredProducts.filter((product) =>
        product.name.toLowerCase().includes(searchLower),
      );
    }

    // Set filter
    if (selectedSetFilter !== 'all') {
      filteredProducts = filteredProducts.filter(
        (product) => product.productSetId === selectedSetFilter,
      );
    }

    // Only watched filter
    if (showOnlyWatched) {
      filteredProducts = filteredProducts.filter((product) => watchlistMap.has(product.id));
    }

    return groupAndSort(filteredProducts, sets ?? []);
  }, [products, sets, searchText, selectedSetFilter, showOnlyWatched, watchlistMap]);

  // Calculate counts for display
  const totalProductsCount = products?.length || 0;
  const filteredProductsCount = useMemo(() => {
    let count = 0;
    groups.forEach((group) => {
      count += group.products.length;
    });
    return count;
  }, [groups]);

  const hasActiveFilters =
    searchText.trim() !== '' || selectedSetFilter !== 'all' || showOnlyWatched;

  const handleClearFilters = () => {
    setSearchText('');
    setSelectedSetFilter('all');
    setShowOnlyWatched(false);
  };

  const isLoading = productsLoading || setsLoading;
  const isError = productsError || setsError;

  const watchlistDisabled = watchlistState !== 'ready';

  return (
    <div className="space-y-10">
      <WatchlistBanner />

      {/* Header and Filters - Sticky */}
      <div className="sticky top-16 z-10 bg-background/80 backdrop-blur-md pb-4 border-b border-border">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between pt-4">
          {/* Header - hidden on mobile, title already visible above fold */}
          <div className="hidden sm:block">
            <h2 className="text-xl font-bold">Watchlista</h2>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
              <span>
                {isLoading ? (
                  <Skeleton className="inline-block h-3.5 w-24 align-middle" />
                ) : hasActiveFilters ? (
                  <>
                    <span className="font-medium text-foreground">{filteredProductsCount}</span> z{' '}
                    {totalProductsCount} produktów
                  </>
                ) : (
                  <>
                    {totalProductsCount}{' '}
                    {totalProductsCount === 1
                      ? 'produkt'
                      : totalProductsCount < 5
                        ? 'produkty'
                        : 'produktów'}
                  </>
                )}
              </span>
              {/* Clear filters button - inline with product count */}
              {hasActiveFilters && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  <FilterX className="h-3 w-3 mr-0.5" />
                  Wyczyść filtry
                </Button>
              )}
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-5 sm:items-center">
            {/* Only watched filter */}
            <div className="flex h-10 w-full sm:w-auto items-center rounded-md border border-input bg-background p-1 gap-1 text-sm">
              {(['all', 'watched'] as const).map((opt) => {
                const isDisabled = opt === 'watched' && !isAuthenticated;
                return (
                  <button
                    key={opt}
                    onClick={() => !isDisabled && setShowOnlyWatched(opt === 'watched')}
                    disabled={isDisabled}
                    className={cn(
                      'flex-1 sm:flex-none rounded-sm px-3 py-1 transition-colors whitespace-nowrap text-center',
                      isDisabled
                        ? 'text-muted-foreground/40 cursor-not-allowed'
                        : (opt === 'watched') === showOnlyWatched
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {opt === 'all' ? (
                      <>
                        <span className="sm:hidden">Wszystkie</span>
                        <span className="hidden sm:inline">Wszystkie produkty</span>
                      </>
                    ) : (
                      'Obserwowane'
                    )}
                  </button>
                );
              })}
            </div>

            {/* Set filter */}
            <Select value={selectedSetFilter} onValueChange={setSelectedSetFilter}>
              <SelectTrigger className="hidden lg:flex w-[200px] !h-10">
                <SelectValue placeholder="Wszystkie sety" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie sety</SelectItem>
                {sets
                  ?.slice()
                  .sort((a, b) => {
                    const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
                    const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
                    return dateB - dateA; // Most recent first
                  })
                  .map((set) => (
                    <SelectItem key={set.id} value={set.id}>
                      {set.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* Search input */}
            <div className="relative w-full sm:flex-none sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Szukaj produktu..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-10 h-10 w-full sm:w-[300px] text-sm"
                autoComplete="off"
              />
            </div>
          </div>
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              {/* Set header — mirrors ProductSetGroup */}
              <div className="flex items-center justify-center sm:justify-start gap-4 pb-3 border-b border-border">
                <Skeleton className="h-14 w-14 shrink-0" />
                <div className="min-w-0 sm:flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              {/* Grid — mirrors ProductGrid columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  /* Mirrors Card className="overflow-hidden border-0 bg-card rounded-lg flex flex-col sm:py-2.5" */
                  <div
                    key={j}
                    className="rounded-lg bg-card overflow-hidden flex flex-col py-6 sm:py-2.5"
                  >
                    {/* Mirrors inner <div className="flex sm:flex-col"> */}
                    <div className="flex sm:flex-col">
                      {/* Mirrors image wrapper: w-20 h-20 sm:w-full sm:h-auto sm:aspect-[4/3] */}
                      <div className="w-20 h-20 sm:w-full sm:h-auto sm:aspect-[3/2] shrink-0 self-center sm:self-auto sm:flex sm:items-center sm:justify-center p-2 sm:p-2">
                        <Skeleton className="w-full h-full sm:h-full sm:w-auto sm:aspect-[4/5] rounded-md" />
                      </div>
                      {/* Mirrors content div */}
                      <div className="flex flex-col flex-1 px-2.5 py-2 sm:px-3 sm:py-1.5 gap-2.5 sm:gap-1.5">
                        {/* Name — mirrors sm:min-h-[1.85rem] */}
                        <div className="space-y-1.5 sm:min-h-[1.85rem]">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-4/5" />
                        </div>
                        {/* Price row — mirrors flex items-center justify-between */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="space-y-1">
                            <Skeleton className="h-5 w-16" />
                            <Skeleton className="h-2.5 w-12" />
                          </div>
                          {/* Toggle — mirrors h-8 sm:h-7, rounded-md button */}
                          <Skeleton className="h-8 sm:h-7 w-16 rounded-md shrink-0" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive" className="max-w-lg mx-auto mt-8">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Błąd ładowania</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              Nie udało się załadować listy produktów. Sprawdź połączenie z internetem i spróbuj
              ponownie.
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
      ) : (
        <>
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
            <div className="text-center text-muted-foreground py-12">
              {hasActiveFilters ? (
                <div>
                  <p className="mb-3">Brak produktów spełniających kryteria wyszukiwania.</p>
                  <Button variant="outline" size="sm" onClick={handleClearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Wyczyść filtry
                  </Button>
                </div>
              ) : (
                <p>Brak produktów do wyświetlenia.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
