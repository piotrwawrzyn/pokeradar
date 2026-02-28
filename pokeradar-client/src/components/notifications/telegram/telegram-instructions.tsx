import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGenerateTelegramToken } from '@/hooks/use-telegram';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useLinkStatusStream } from '@/hooks/use-link-status-stream';
import { CopyTokenBox } from '@/components/notifications/copy-token-box';
import { StepNumber } from '@/components/notifications/step-number';
import { ExternalLink } from '@/components/ui/external-link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function TelegramInstructions() {
  const { data: profile } = useUserProfile();
  const generateToken = useGenerateTelegramToken();
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const token = generatedToken ?? profile?.telegram.linkToken ?? null;
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

  useLinkStatusStream(token, 'Telegram połączony! Twoje konto zostało pomyślnie połączone.');

  const handleGenerate = () => {
    generateToken.mutate(undefined, {
      onSuccess: (data) => {
        setGeneratedToken(data.linkToken);
      },
      onError: () => {
        toast.error('Nie udało się wygenerować tokenu');
      },
    });
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm">Jak połączyć Telegram:</h4>
      <ol className="space-y-5 text-sm">
        <li className="flex gap-3 items-center">
          <StepNumber number={1} />
          <span>
            Otwórz Telegram i wyszukaj bota{' '}
            <ExternalLink
              href={`https://t.me/${botUsername}`}
              className="font-bold text-primary hover:underline"
            >
              @{botUsername}
            </ExternalLink>
          </span>
        </li>
        {!token ? (
          <li className="flex gap-3 items-start">
            <StepNumber number={2} />
            <div className="flex flex-col gap-2">
              <p className="leading-6">Wygeneruj token połączenia:</p>
              <div>
                <Button size="sm" onClick={handleGenerate} disabled={generateToken.isPending}>
                  {generateToken.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Wygeneruj token
                </Button>
              </div>
            </div>
          </li>
        ) : (
          <li className="flex gap-3 items-start">
            <StepNumber number={2} />
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <p className="leading-6">
                Użyj komendy{' '}
                <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/link</code> i
                wklej poniższy token:
              </p>
              <CopyTokenBox token={token} />
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}
