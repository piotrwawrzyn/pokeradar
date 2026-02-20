import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WatchlistToggle } from '@/components/watchlist/watchlist-toggle';
import { MaxPriceInput } from '@/components/watchlist/max-price-input';
import { formatPLN } from '@/lib/format';
import type { Product, WatchlistEntry } from '@/types';

interface ProductCardProps {
  product: Product;
  entry: WatchlistEntry | undefined;
  watchlistDisabled: boolean;
}

export function ProductCard({ product, entry, watchlistDisabled }: ProductCardProps) {
  const isWatched = !!entry;

  const priceContent = (
    <>
      {product.currentBestPrice !== null ? (
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] text-muted-foreground">od</span>
          <p className="text-base font-bold text-primary tabular-nums">
            {formatPLN(product.currentBestPrice)}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Brak ceny</p>
      )}
      {product.currentBestShop && (
        <p className="text-[10px] text-muted-foreground tracking-wide uppercase truncate">
          {product.currentBestShop}
        </p>
      )}
    </>
  );

  return (
    <Card className="overflow-hidden border border-border bg-card rounded-lg flex flex-col sm:py-2.5">
      {/* Image + Info: horizontal on mobile, vertical on sm+ */}
      <div className="flex sm:flex-col">
        {/* Image */}
        <div className="w-20 h-20 sm:w-full sm:h-auto sm:aspect-[4/3] relative overflow-hidden shrink-0">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-contain p-1 sm:p-1.5"
            loading="lazy"
          />
          {product.disabled && (
            <Badge variant="destructive" className="absolute top-1 right-1 text-xs">
              Niedostępny
            </Badge>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col flex-1 px-2.5 py-2 sm:px-3 sm:py-1.5 gap-2.5 sm:gap-1.5">
          <h3 className="font-medium text-sm sm:text-xs leading-tight line-clamp-2 sm:min-h-[1.85rem]">
            {product.name}
          </h3>
          <div className="flex items-center justify-between gap-2">
            {product.currentBestUrl ? (
              <a
                href={product.currentBestUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block min-w-0"
              >
                {priceContent}
              </a>
            ) : (
              <div className="min-w-0">{priceContent}</div>
            )}
            <WatchlistToggle
              product={product}
              entry={entry}
              disabled={watchlistDisabled}
            />
          </div>
          {isWatched && (
            <div className="mt-auto">
              <MaxPriceInput
                entryId={entry.id}
                currentMaxPrice={entry.maxPrice}
                currentBestPrice={product.currentBestPrice}
                disabled={watchlistDisabled || !!product.disabled}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
