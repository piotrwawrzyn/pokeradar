import { useUserProfile } from '@/hooks/use-user-profile';
import { DiscordInstructions } from './discord-instructions';
import { DiscordStatus } from './discord-status';

export function DiscordSetup() {
  const { data: profile } = useUserProfile();

  if (profile?.discord.linked) {
    return <DiscordStatus />;
  }

  return <DiscordInstructions />;
}
