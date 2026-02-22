import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
}

export function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <IconBox icon={Icon} size="md" />
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}
