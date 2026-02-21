import { ProductGrid } from './product-grid';
import { formatDate } from '@/lib/format';
import type { Product, ProductSet, WatchlistEntry } from '@/types';

interface ProductSetGroupProps {
  set: ProductSet | null;
  products: Product[];
  watchlistMap: Map<string, WatchlistEntry>;
  watchlistDisabled: boolean;
}

export function ProductSetGroup({
  set,
  products,
  watchlistMap,
  watchlistDisabled,
}: ProductSetGroupProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center sm:justify-start gap-4 pb-3 border-b border-border">
        {set?.imageUrl && (
          <img src={set.imageUrl} alt={set.name} className="h-14 w-14 object-contain shrink-0" />
        )}
        <div className="min-w-0 sm:flex-1">
          <h2 className="font-semibold text-base truncate text-foreground">
            {set?.name ?? 'Inne'}
          </h2>
          {set && (
            <p className="text-xs text-muted-foreground">
              {set.series}
              {set.releaseDate && ` · ${formatDate(set.releaseDate)}`}
            </p>
          )}
        </div>
      </div>
      <ProductGrid
        products={products}
        watchlistMap={watchlistMap}
        watchlistDisabled={watchlistDisabled}
      />
    </div>
  );
}
