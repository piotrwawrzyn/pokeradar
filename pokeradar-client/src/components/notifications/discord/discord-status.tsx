import { Button } from '@/components/ui/button';
import { useUnlinkDiscord } from '@/hooks/use-discord';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function DiscordStatus() {
  const unlinkDiscord = useUnlinkDiscord();

  const handleUnlink = () => {
    unlinkDiscord.mutate(undefined, {
      onSuccess: () => {
        toast.success('Discord został odłączony');
      },
      onError: () => {
        toast.error('Nie udało się odłączyć Discorda');
      },
    });
  };

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">Konto Discord jest połączone z pokeradar</p>
      <Button
        variant="outline"
        size="sm"
        onClick={handleUnlink}
        disabled={unlinkDiscord.isPending}
      >
        {unlinkDiscord.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        Odłącz
      </Button>
    </div>
  );
}
