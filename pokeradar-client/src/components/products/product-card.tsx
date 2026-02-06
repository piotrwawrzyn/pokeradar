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
    <Card className="overflow-hidden border-0 shadow-none bg-background rounded-lg flex flex-col">
      <div className="aspect-[5/4] relative overflow-hidden">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-contain p-1.5"
          loading="lazy"
        />
        {product.disabled && (
          <Badge variant="destructive" className="absolute top-2 right-2 text-xs">
            Niedostępny
          </Badge>
        )}
      </div>
      <CardContent className="px-3 py-2 space-y-2 flex flex-col flex-1">
        <h3 className="font-medium text-xs leading-tight line-clamp-2 min-h-[2rem]">
          {product.name}
        </h3>

        <div className="flex items-center justify-between gap-2">
          {product.currentBestUrl ? (
            <a
              href={product.currentBestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
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
                <p className="text-[10px] text-muted-foreground tracking-wide uppercase ">
                  {product.currentBestShop}
                </p>
              )}
            </a>
          ) : (
            <div>
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
                <p className="text-[10px] text-muted-foreground tracking-wide uppercase">
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
