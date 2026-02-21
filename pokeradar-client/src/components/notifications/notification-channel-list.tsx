import { NotificationChannelCard } from './notification-channel-card';
import { TelegramSetup } from './telegram/telegram-setup';
import { TelegramIcon } from './telegram/telegram-icon';
import { DiscordSetup } from './discord/discord-setup';
import { DiscordIcon } from './discord/discord-icon';
import { useUserProfile } from '@/hooks/use-user-profile';
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { UserProfile } from '@/types';

interface NotificationChannelConfig {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon | ComponentType<{ className?: string }>;
  component: ComponentType;
  isAvailable: boolean;
  getIsLinked: (profile: UserProfile | undefined) => boolean;
}

const NOTIFICATION_CHANNELS: NotificationChannelConfig[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Otrzymuj natychmiastowe powiadomienia przez Telegram',
    icon: TelegramIcon,
    component: TelegramSetup,
    isAvailable: true,
    getIsLinked: (profile) => profile?.telegram.linked ?? false,
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Otrzymuj natychmiastowe powiadomienia przez Discord',
    icon: DiscordIcon,
    component: DiscordSetup,
    isAvailable: true,
    getIsLinked: (profile) => profile?.discord.linked ?? false,
  },
];

export function NotificationChannelList() {
  const { data: profile } = useUserProfile();

  return (
    <div className="space-y-4">
      {NOTIFICATION_CHANNELS.map((channel) => {
        const ChannelComponent = channel.component;
        return (
          <NotificationChannelCard
            key={channel.id}
            name={channel.name}
            description={channel.description}
            icon={channel.icon as LucideIcon}
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
