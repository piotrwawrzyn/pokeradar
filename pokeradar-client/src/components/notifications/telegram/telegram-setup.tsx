import { useUserProfile } from '@/hooks/use-user-profile';
import { TelegramInstructions } from './telegram-instructions';
import { TelegramStatus } from './telegram-status';

export function TelegramSetup() {
  const { data: profile } = useUserProfile();

  if (profile?.telegram.linked) {
    return <TelegramStatus />;
  }

  return <TelegramInstructions />;
}
