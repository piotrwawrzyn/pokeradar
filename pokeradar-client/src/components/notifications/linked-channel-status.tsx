import { Button } from '@/components/ui/button';
import { Loader2, Link2Off } from 'lucide-react';

interface LinkedChannelStatusProps {
  channelName: string;
  isPending: boolean;
  onUnlink: () => void;
}

export function LinkedChannelStatus({
  channelName,
  isPending,
  onUnlink,
}: LinkedChannelStatusProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        Konto {channelName} jest połączone z pokeradar
      </p>
      <Button variant="secondary" size="sm" onClick={onUnlink} disabled={isPending}>
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Link2Off className="mr-2 h-4 w-4" />
        )}
        Odłącz
      </Button>
    </div>
  );
}
