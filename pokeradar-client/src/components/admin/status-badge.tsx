import { Badge } from '@/components/ui/badge';

type Status = 'sent' | 'pending' | 'failed' | 'warning' | 'ok' | 'active' | 'inactive';

interface StatusBadgeProps {
  status: Status;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const variants: Record<Status, { className: string; text: string }> = {
    sent: { className: 'bg-green-500/10 text-green-500 hover:bg-green-500/20', text: 'Wysłano' },
    ok: { className: 'bg-green-500/10 text-green-500 hover:bg-green-500/20', text: 'OK' },
    active: { className: 'bg-green-500/10 text-green-500 hover:bg-green-500/20', text: 'Aktywne' },
    pending: {
      className: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20',
      text: 'Oczekuje',
    },
    warning: {
      className: 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20',
      text: 'Ostrzeżenie',
    },
    failed: { className: 'bg-red-500/10 text-red-500 hover:bg-red-500/20', text: 'Błąd' },
    inactive: {
      className: 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20',
      text: 'Nieaktywne',
    },
  };

  const config = variants[status];

  return <Badge className={config.className}>{label || config.text}</Badge>;
}
