import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { useUpdateWatchEntry } from '@/hooks/use-watchlist';
import { toast } from 'sonner';

interface MaxPriceInputProps {
  entryId: string;
  currentMaxPrice: number;
  currentBestPrice: number | null;
  disabled?: boolean;
}

export function MaxPriceInput({
  entryId,
  currentMaxPrice,
  currentBestPrice,
  disabled = false,
}: MaxPriceInputProps) {
  const [value, setValue] = useState(currentMaxPrice.toString());
  const [error, setError] = useState<string | null>(null);
  const debouncedValue = useDebounce(value, 500);
  const updateEntry = useUpdateWatchEntry();
  const mutateRef = useRef(updateEntry.mutate);
  mutateRef.current = updateEntry.mutate;

  // Sync external changes
  useEffect(() => {
    setValue(currentMaxPrice.toString());
  }, [currentMaxPrice]);

  // Auto-save on debounced value change
  useEffect(() => {
    const numValue = parseFloat(debouncedValue);
    if (isNaN(numValue) || numValue <= 0) {
      setError('Podaj prawidłową kwotę');
      return;
    }

    if (currentBestPrice !== null && numValue > currentBestPrice) {
      setError(
        `Maksymalna cena nie może przekraczać aktualnej najlepszej ceny (${currentBestPrice.toFixed(2)} zł)`,
      );
      return;
    }

    setError(null);

    if (numValue !== currentMaxPrice) {
      mutateRef.current(
        { id: entryId, data: { maxPrice: numValue } },
        {
          onError: () => toast.error('Nie udało się zapisać ceny'),
        },
      );
    }
  }, [debouncedValue, entryId, currentMaxPrice, currentBestPrice]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Maks. cena:
        </span>
        <Input
          type="number"
          min={0.01}
          step={0.01}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          className="h-8 w-24 text-sm"
          aria-label="Maksymalna cena"
        />
        <span className="text-xs text-muted-foreground">zł</span>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
