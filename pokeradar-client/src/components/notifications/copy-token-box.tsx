import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Copy, Check } from 'lucide-react';

interface CopyTokenBoxProps {
  token: string;
}

export function CopyTokenBox({ token }: CopyTokenBoxProps) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
      <code className="text-xs flex-1 break-all font-mono">{token}</code>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copy(token)}>
        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
