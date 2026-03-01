import { LinkedChannelStatus } from '@/components/notifications/linked-channel-status';
import { useUnlinkTelegram } from '@/hooks/use-telegram';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useWatchlist } from '@/hooks/use-watchlist';
import { toast } from 'sonner';

export function TelegramStatus() {
  const unlinkTelegram = useUnlinkTelegram();
  const { data: profile } = useUserProfile();
  const { data: watchlist } = useWatchlist();

  const isLastChannel = !profile?.discord.linked;
  const watchlistCount = watchlist?.length ?? 0;

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
    <LinkedChannelStatus
      channelName="Telegram"
      isPending={unlinkTelegram.isPending}
      onUnlink={handleUnlink}
      isLastChannel={isLastChannel}
      watchlistCount={watchlistCount}
    />
  );
}
