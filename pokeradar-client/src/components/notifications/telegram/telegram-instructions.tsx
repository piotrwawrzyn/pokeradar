import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGenerateTelegramToken } from '@/hooks/use-telegram';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function TelegramInstructions() {
  const { data: profile } = useUserProfile();
  const generateToken = useGenerateTelegramToken();
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const token = generatedToken ?? profile?.telegramLinkToken ?? null;

  const handleGenerate = () => {
    generateToken.mutate(undefined, {
      onSuccess: (data) => {
        setGeneratedToken(data.telegramLinkToken);
      },
      onError: () => {
        toast.error('Nie udało się wygenerować tokenu');
      },
    });
  };

  const handleCopy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(`/link ${token}`);
    setCopied(true);
    toast.success('Skopiowano do schowka');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm">Jak połączyć Telegram:</h4>
      <ol className="space-y-3 text-sm">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
            1
          </span>
          <span>
            Otwórz Telegram i wyszukaj bota{' '}
            <a
              href="https://t.me/tcg_pokemon_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-primary hover:underline"
            >
              @tcg_pokemon_bot
            </a>
          </span>
        </li>
        {!token ? (
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
              2
            </span>
            <div className="flex flex-col gap-2">
              <p>Wygeneruj token połączenia:</p>
              <div>
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generateToken.isPending}
                >
                  {generateToken.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Wygeneruj token
                </Button>
              </div>
            </div>
          </li>
        ) : (
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
              2
            </span>
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <p>Wyślij do bota poniższe polecenie:</p>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
                <code className="text-xs flex-1 break-all font-mono">
                  /link {token}
                </code>
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
