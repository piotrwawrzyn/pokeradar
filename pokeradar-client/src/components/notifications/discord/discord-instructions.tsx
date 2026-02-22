import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGenerateDiscordToken } from '@/hooks/use-discord';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Copy, Check, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

export function DiscordInstructions() {
  const { data: profile } = useUserProfile();
  const generateToken = useGenerateDiscordToken();
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const token = generatedToken ?? profile?.discord.linkToken ?? null;
  const serverUrl = import.meta.env.VITE_DISCORD_SERVER_URL as string | undefined;
  const botDmUrl = import.meta.env.VITE_DISCORD_BOT_DM_URL as string | undefined;

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

  const handleCopy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success('Skopiowano do schowka');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm">Jak połączyć Discord:</h4>
      <ol className="space-y-5 text-sm">
        <li className="flex gap-3 items-start">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
            1
          </span>
          <div className="flex flex-col gap-1.5">
            <span className="leading-6">
              {serverUrl ? (
                <>
                  Dołącz do{' '}
                  <a
                    href={serverUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-primary hover:underline"
                  >
                    serwera Discord pokeradar
                  </a>
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
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
            2
          </span>
          <span>
            {botDmUrl ? (
              <>
                Otwórz{' '}
                <a
                  href={botDmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-primary hover:underline"
                >
                  prywatną wiadomość z botem pokeradar
                </a>
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
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
              3
            </span>
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
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
              3
            </span>
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <p className="leading-6">
                Użyj komendy{' '}
                <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/link</code> i
                wklej poniższy token:
              </p>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
                <code className="text-xs flex-1 break-all font-mono">{token}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}
