import { useMemo, useState } from 'react';
import { useProducts } from '@/hooks/use-products';
import { useProductSets } from '@/hooks/use-product-sets';
import { useWatchlist } from '@/hooks/use-watchlist';
import { useWatchlistState, WatchlistBanner } from '@/components/watchlist/login-prompt';
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
  const { data: products, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useProducts();
  const { data: sets, isLoading: setsLoading, isError: setsError, refetch: refetchSets } = useProductSets();
  const { data: watchlist } = useWatchlist();
  const watchlistState = useWatchlistState();

  // Filter state
  const [searchText, setSearchText] = useState('');
  const [selectedSetFilter, setSelectedSetFilter] = useState<string>('all');

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
        product.name.toLowerCase().includes(searchLower)
      );
    }

    // Set filter
    if (selectedSetFilter !== 'all') {
      filteredProducts = filteredProducts.filter((product) =>
        product.productSetId === selectedSetFilter
      );
    }

    return groupAndSort(filteredProducts, sets ?? []);
  }, [products, sets, searchText, selectedSetFilter]);

  // Calculate counts for display
  const totalProductsCount = products?.length || 0;
  const filteredProductsCount = useMemo(() => {
    let count = 0;
    groups.forEach((group) => {
      count += group.products.length;
    });
    return count;
  }, [groups]);

  const hasActiveFilters = searchText.trim() !== '' || selectedSetFilter !== 'all';

  const handleClearFilters = () => {
    setSearchText('');
    setSelectedSetFilter('all');
  };

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

      {/* Header and Filters - Sticky */}
      <div className="sticky top-0 z-10 bg-background pb-4 border-b border-border">
        <div className="flex gap-4 items-center justify-between flex-wrap pt-4">
          {/* Header */}
          <div>
            <h2 className="text-xl font-bold">Watchlista</h2>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
              <span>
                {hasActiveFilters ? (
                  <>
                    <span className="font-medium text-foreground">{filteredProductsCount}</span> z {totalProductsCount} produktów
                  </>
                ) : (
                  <>{totalProductsCount} {totalProductsCount === 1 ? 'produkt' : totalProductsCount < 5 ? 'produkty' : 'produktów'}</>
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
          <div className="flex gap-3 items-center flex-wrap">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Szukaj produktu..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-10 h-10 w-[250px]"
                autoComplete="off"
              />
            </div>

            {/* Set filter */}
            <Select value={selectedSetFilter} onValueChange={setSelectedSetFilter}>
              <SelectTrigger className="w-[200px] !h-10">
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
          </div>
        </div>
      </div>
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
              >
                <X className="h-4 w-4 mr-2" />
                Wyczyść filtry
              </Button>
            </div>
          ) : (
            <p>Brak produktów do wyświetlenia.</p>
          )}
        </div>
      )}
    </div>
  );
}
