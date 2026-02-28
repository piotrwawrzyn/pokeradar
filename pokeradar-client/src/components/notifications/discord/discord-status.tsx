import { LinkedChannelStatus } from '@/components/notifications/linked-channel-status';
import { useUnlinkDiscord } from '@/hooks/use-discord';
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
    <LinkedChannelStatus
      channelName="Discord"
      isPending={unlinkDiscord.isPending}
      onUnlink={handleUnlink}
    />
  );
}
