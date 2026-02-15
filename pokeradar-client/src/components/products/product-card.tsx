import { Card, CardContent } from '@/components/ui/card';
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

  return (
    <Card className="overflow-hidden border-0 shadow-none bg-background rounded-lg flex flex-col py-1 sm:py-2.5 gap-0">
      <div className="aspect-video sm:aspect-[4/3] relative overflow-hidden">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-contain p-0.5 sm:p-1.5"
          loading="lazy"
        />
        {product.disabled && (
          <Badge variant="destructive" className="absolute top-1 sm:top-2 right-1 sm:right-2 text-xs">
            Niedostępny
          </Badge>
        )}
      </div>
      <CardContent className="px-2.5 sm:px-3 py-2 sm:py-1.5 space-y-1.5 sm:space-y-1.5 flex flex-col flex-1">
        <h3 className="font-medium text-xs leading-tight line-clamp-2 min-h-[1.6rem] sm:min-h-[1.85rem]">
          {product.name}
        </h3>

        <div className="flex items-center justify-between gap-2.5 sm:gap-2">
          {product.currentBestUrl ? (
            <a
              href={product.currentBestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block min-w-0"
            >
              {product.currentBestPrice !== null ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] text-muted-foreground">od</span>
                  <p className="text-base font-bold text-primary tabular-nums ">
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
            </a>
          ) : (
            <div className="min-w-0">
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
            </div>
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
      </CardContent>
    </Card>
  );
}
