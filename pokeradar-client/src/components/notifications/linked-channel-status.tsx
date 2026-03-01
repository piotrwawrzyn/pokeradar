import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Loader2, Link2Off } from 'lucide-react';

interface LinkedChannelStatusProps {
  channelName: string;
  isPending: boolean;
  onUnlink: () => void;
  isLastChannel?: boolean;
  watchlistCount?: number;
}

export function LinkedChannelStatus({
  channelName,
  isPending,
  onUnlink,
  isLastChannel = false,
  watchlistCount = 0,
}: LinkedChannelStatusProps) {
  const showConfirmation = isLastChannel && watchlistCount > 0;

  const unlinkButton = (
    <Button variant="secondary" size="sm" disabled={isPending}>
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Link2Off className="mr-2 h-4 w-4" />
      )}
      Odłącz
    </Button>
  );

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        Konto {channelName} jest połączone z pokeradar
      </p>
      {showConfirmation ? (
        <ConfirmDialog
          trigger={unlinkButton}
          icon={Link2Off}
          title={`Odłączyć ${channelName}?`}
          description={
            <>
              To jedyny skonfigurowany kanał powiadomień.
              <br />
              <br />
              <span className="font-medium text-foreground">
                Odłączenie usunie wszystkie pozycje z Twojej listy obserwowanych ({watchlistCount}).
              </span>
            </>
          }
          confirmLabel="Odłącz i wyczyść"
          isPending={isPending}
          onConfirm={onUnlink}
        />
      ) : (
        <Button variant="secondary" size="sm" onClick={onUnlink} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Link2Off className="mr-2 h-4 w-4" />
          )}
          Odłącz
        </Button>
      )}
    </div>
  );
}
