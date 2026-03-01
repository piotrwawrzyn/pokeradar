import { useEffect, useRef, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { useDebounce } from '@/hooks/use-debounce';
import { useUpdateWatchEntry } from '@/hooks/use-watchlist';
import { formatPLN } from '@/lib/format';
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
  const [value, setValue] = useState(currentMaxPrice);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const debouncedValue = useDebounce(value, 500);
  const updateEntry = useUpdateWatchEntry();
  const mutateRef = useRef(updateEntry.mutate);
  useEffect(() => {
    mutateRef.current = updateEntry.mutate;
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute slider max once on mount so it stays consistent during the session
  const [max] = useState(() =>
    currentBestPrice !== null ? Math.max(currentBestPrice, currentMaxPrice) : Infinity,
  );

  // serverPrice tracks the last value the server confirmed (prop value).
  // Used to detect external updates so we can reset the slider.
  const [serverPrice, setServerPrice] = useState(currentMaxPrice);

  // serverPrice tracks the last value the server confirmed (prop value).
  // When the prop changes, reset local state to follow the external update.
  // This is the React-recommended "get derived state from props" pattern.
  if (currentMaxPrice !== serverPrice) {
    setServerPrice(currentMaxPrice);
    setValue(currentMaxPrice);
  }

  // lastSentPrice tracks the last value fired to the server, to deduplicate
  // within a single effect run (read only inside the effect, never during render).
  const lastSentPriceRef = useRef(currentMaxPrice);

  // Auto-save on debounced value change
  useEffect(() => {
    if (debouncedValue <= 0 || debouncedValue === lastSentPriceRef.current) return;

    lastSentPriceRef.current = debouncedValue;
    mutateRef.current(
      { id: entryId, data: { maxPrice: debouncedValue } },
      {
        onError: () => toast.error('Nie udało się zapisać ceny'),
      },
    );
  }, [debouncedValue, entryId]);

  // Auto-focus & select when entering edit mode
  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const handleStartEdit = () => {
    if (disabled) return;
    setInputValue(String(value));
    setIsEditing(true);
  };

  const handleConfirmEdit = () => {
    const parsed = parseFloat(inputValue);
    if (!Number.isNaN(parsed) && parsed >= 1) {
      const next = Math.min(Math.round(parsed * 100) / 100, max);
      setValue(next);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirmEdit();
    if (e.key === 'Escape') setIsEditing(false);
  };

  const priceLabel = (
    <div className="flex items-center justify-between min-h-[2rem] sm:min-h-[1.5rem]">
      <span className="text-xs text-muted-foreground">Limit cenowy:</span>
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleConfirmEdit}
          onKeyDown={handleKeyDown}
          placeholder="np. 149,99"
          className="h-7 sm:h-6 w-28 sm:w-24 text-right text-sm sm:text-xs font-medium tabular-nums bg-transparent border-b border-primary text-primary placeholder:text-muted-foreground/50 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          min={1}
          max={max === Infinity ? undefined : max}
          step={0.01}
          aria-label="Wpisz maksymalną cenę"
        />
      ) : (
        <button
          type="button"
          onClick={handleStartEdit}
          disabled={disabled}
          className="min-w-[5rem] sm:min-w-20 h-7 sm:h-6 px-1 sm:px-0 text-right text-sm sm:text-xs font-medium tabular-nums text-primary cursor-pointer border-b border-transparent hover:border-primary/50 transition-colors disabled:cursor-default disabled:hover:border-transparent"
        >
          {formatPLN(value)}
        </button>
      )}
    </div>
  );

  const hasSlider = currentBestPrice !== null;

  return (
    <div className="space-y-1.5 pt-2.5">
      {priceLabel}
      <div className={hasSlider ? undefined : 'invisible'}>
        <Slider
          min={1}
          max={hasSlider ? max : 100}
          step={0.01}
          value={[hasSlider ? value : 50]}
          onValueChange={hasSlider ? ([v]) => setValue(Math.round(v * 100) / 100) : undefined}
          disabled={disabled || !hasSlider}
          aria-label="Maksymalna cena"
          aria-hidden={!hasSlider}
        />
      </div>
    </div>
  );
}
