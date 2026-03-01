import { LinkedChannelStatus } from '@/components/notifications/linked-channel-status';
import { useUnlinkDiscord } from '@/hooks/use-discord';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useWatchlist } from '@/hooks/use-watchlist';
import { toast } from 'sonner';

export function DiscordStatus() {
  const unlinkDiscord = useUnlinkDiscord();
  const { data: profile } = useUserProfile();
  const { data: watchlist } = useWatchlist();

  const isLastChannel = !profile?.telegram.linked;
  const watchlistCount = watchlist?.length ?? 0;

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
    <LinkedChannelStatus
      channelName="Discord"
      isPending={unlinkDiscord.isPending}
      onUnlink={handleUnlink}
      isLastChannel={isLastChannel}
      watchlistCount={watchlistCount}
    />
  );
}
