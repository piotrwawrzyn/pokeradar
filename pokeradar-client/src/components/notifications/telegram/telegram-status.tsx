import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUnlinkTelegram } from '@/hooks/use-telegram';
import { CheckCircle2, Loader2 } from 'lucide-react';
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
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        <Badge variant="outline" className="border-green-500/30 text-green-500">
          Połączony
        </Badge>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleUnlink}
        disabled={unlinkTelegram.isPending}
      >
        {unlinkTelegram.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        Odłącz
      </Button>
    </div>
  );
}
