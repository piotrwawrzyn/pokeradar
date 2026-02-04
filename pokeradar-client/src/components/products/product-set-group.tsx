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
    <div className="rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {set?.imageUrl && (
          <img
            src={set.imageUrl}
            alt={set.name}
            className="h-12 w-12 rounded-md object-contain"
          />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-sm truncate tracking-tight">
            {set?.name ?? 'Inne'}
          </h2>
          {set && (
            <p className="text-[11px] text-muted-foreground">
              {set.series}
              {set.releaseDate && ` · ${formatDate(set.releaseDate)}`}
            </p>
          )}
        </div>
      </div>
      <div className="px-3 pb-3 pt-1">
        <ProductGrid
          products={products}
          watchlistMap={watchlistMap}
          watchlistDisabled={watchlistDisabled}
        />
      </div>
    </div>
  );
}
