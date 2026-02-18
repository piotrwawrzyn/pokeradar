import { ProductCard } from './product-card';
import type { Product, WatchlistEntry } from '@/types';

interface ProductGridProps {
  products: Product[];
  watchlistMap: Map<string, WatchlistEntry>;
  watchlistDisabled: boolean;
}

export function ProductGrid({
  products,
  watchlistMap,
  watchlistDisabled,
}: ProductGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          entry={watchlistMap.get(product.id)}
          watchlistDisabled={watchlistDisabled}
        />
      ))}
    </div>
  );
}
