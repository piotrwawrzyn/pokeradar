import { Button } from '@/components/ui/button';
import { useUnlinkTelegram } from '@/hooks/use-telegram';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function TelegramStatus() {
  const unlinkTelegram = useUnlinkTelegram();

  const handleUnlink = () => {
    unlinkTelegram.mutate(undefined, {
      onSuccess: () => {
        toast.success('Telegram został odłączony');
      },
      onError: () => {
        toast.error('Nie udało się odłączyć Telegrama');
      },
    });
  };

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">Konto Telegram jest połączone z pokeradar</p>
      <Button
        variant="outline"
        size="sm"
        onClick={handleUnlink}
        disabled={unlinkTelegram.isPending}
      >
        {unlinkTelegram.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Odłącz
      </Button>
    </div>
  );
}
