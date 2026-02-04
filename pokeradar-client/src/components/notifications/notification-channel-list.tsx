import { Mail } from 'lucide-react';
import { NotificationChannelCard } from './notification-channel-card';
import { TelegramSetup } from './telegram/telegram-setup';
import { TelegramIcon } from './telegram/telegram-icon';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useUserProfile } from '@/hooks/use-user-profile';
import type { ComponentType, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface NotificationChannelConfig {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon | ComponentType<{ className?: string }>;
  component: ComponentType;
  isAvailable: boolean;
  getIsLinked: (profile: { telegramLinked: boolean } | undefined) => boolean;
}

const NOTIFICATION_CHANNELS: NotificationChannelConfig[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Otrzymuj powiadomienia przez Telegram',
    icon: TelegramIcon,
    component: TelegramSetup,
    isAvailable: true,
    getIsLinked: (profile) => profile?.telegramLinked ?? false,
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Powiadomienia na adres email',
    icon: Mail,
    component: () => null,
    isAvailable: false,
    getIsLinked: () => false,
  },
];

export function NotificationChannelList() {
  const { data: profile } = useUserProfile();

  return (
    <div className="space-y-4">
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription>
          Obecnie wspieramy tylko powiadomienia przez Telegram. Pracujemy nad
          dodaniem kolejnych opcji.
        </AlertDescription>
      </Alert>

      {NOTIFICATION_CHANNELS.map((channel) => {
        const ChannelComponent = channel.component;
        return (
          <NotificationChannelCard
            key={channel.id}
            name={channel.name}
            description={channel.description}
            icon={channel.icon}
            isLinked={channel.getIsLinked(profile)}
            isAvailable={channel.isAvailable}
          >
            <ChannelComponent />
          </NotificationChannelCard>
        );
      })}
    </div>
  );
}
