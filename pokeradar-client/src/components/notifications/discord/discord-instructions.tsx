import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGenerateDiscordToken } from '@/hooks/use-discord';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useLinkStatusStream } from '@/hooks/use-link-status-stream';
import { CopyTokenBox } from '@/components/notifications/copy-token-box';
import { StepNumber } from '@/components/notifications/step-number';
import { ExternalLink } from '@/components/ui/external-link';
import { Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

export function DiscordInstructions() {
  const { data: profile } = useUserProfile();
  const generateToken = useGenerateDiscordToken();
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const token = generatedToken ?? profile?.discord.linkToken ?? null;
  const serverUrl = import.meta.env.VITE_DISCORD_SERVER_URL as string | undefined;
  const botDmUrl = import.meta.env.VITE_DISCORD_BOT_DM_URL as string | undefined;

  useLinkStatusStream(token, 'Discord połączony! Twoje konto zostało pomyślnie połączone.');

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
      <h4 className="font-medium text-sm">Jak połączyć Discord:</h4>
      <ol className="space-y-5 text-sm">
        <li className="flex gap-3 items-start">
          <StepNumber number={1} />
          <div className="flex flex-col gap-1.5">
            <span className="leading-6">
              {serverUrl ? (
                <>
                  Dołącz do{' '}
                  <ExternalLink href={serverUrl} className="font-bold text-primary hover:underline">
                    serwera Discord pokeradar
                  </ExternalLink>
                </>
              ) : (
                <>
                  Dołącz do serwera Discord <span className="font-bold">pokeradar</span>
                </>
              )}
            </span>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Bot może wysyłać wiadomości tylko do członków serwera.
            </p>
          </div>
        </li>
        <li className="flex gap-3 items-center">
          <StepNumber number={2} />
          <span>
            {botDmUrl ? (
              <>
                Otwórz{' '}
                <ExternalLink href={botDmUrl} className="font-bold text-primary hover:underline">
                  prywatną wiadomość z botem pokeradar
                </ExternalLink>
              </>
            ) : (
              <>
                Otwórz prywatną wiadomość z botem <span className="font-bold">pokeradar</span>
              </>
            )}
          </span>
        </li>
        {!token ? (
          <li className="flex gap-3 items-start">
            <StepNumber number={3} />
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
            <StepNumber number={3} />
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
