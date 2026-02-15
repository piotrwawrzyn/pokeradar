import { Button } from '@/components/ui/button';
import { Bell, BellRing, Loader2 } from 'lucide-react';
import { useAddWatchEntry, useDeleteWatchEntry } from '@/hooks/use-watchlist';
import type { Product, WatchlistEntry } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WatchlistToggleProps {
  product: Product;
  entry: WatchlistEntry | undefined;
  disabled: boolean;
}

export function WatchlistToggle({ product, entry, disabled }: WatchlistToggleProps) {
  const addEntry = useAddWatchEntry();
  const deleteEntry = useDeleteWatchEntry();

  const isWatched = !!entry;
  const isLoading = addEntry.isPending || deleteEntry.isPending;
  const isDisabled = disabled || isLoading || !!product.disabled;

  const handleClick = () => {
    if (isDisabled) return;

    if (!isWatched) {
      const initialMaxPrice = product.currentBestPrice
        ? Math.floor(product.currentBestPrice * 0.95)
        : 999;
      addEntry.mutate(
        { productId: product.id, maxPrice: initialMaxPrice },
        {
          onError: () => toast.error('Nie udało się dodać do listy obserwowanych'),
        },
      );
    } else if (entry) {
      deleteEntry.mutate(entry.id, {
        onError: () => toast.error('Nie udało się usunąć z listy obserwowanych'),
      });
    }
  };

  return (
    <Button
      variant={isWatched ? 'default' : 'secondary'}
      size="sm"
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(
        'h-7 text-xs',
        isWatched ? 'w-8 p-0' : 'gap-1.5 px-2.5',
        isWatched && 'bg-primary text-primary-foreground border border-primary',
      )}
      aria-label={`Dodaj ${product.name}`}
      role="switch"
      aria-checked={isWatched}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isWatched ? (
        <BellRing className="h-3.5 w-3.5" />
      ) : (
        <>
          <Bell className="h-3.5 w-3.5" />
          Dodaj
        </>
      )}
    </Button>
  );
}
