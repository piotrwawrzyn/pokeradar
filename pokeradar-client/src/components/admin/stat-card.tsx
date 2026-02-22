import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: 'default' | 'warning' | 'success';
}

export function StatCard({ label, value, icon: Icon, variant = 'default' }: StatCardProps) {
  const variantClasses = {
    default: 'text-foreground',
    warning: 'text-orange-500',
    success: 'text-green-500',
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-accent ${variantClasses[variant]}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}
