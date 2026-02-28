import { LinkedChannelStatus } from '@/components/notifications/linked-channel-status';
import { useUnlinkTelegram } from '@/hooks/use-telegram';
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
    <LinkedChannelStatus
      channelName="Telegram"
      isPending={unlinkTelegram.isPending}
      onUnlink={handleUnlink}
    />
  );
}
