import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type IconBoxSize = 'sm' | 'md';

interface IconBoxProps {
  icon: LucideIcon;
  size?: IconBoxSize;
}

const sizeClasses: Record<IconBoxSize, string> = {
  sm: 'p-2',
  md: 'w-10 h-10',
};

export function IconBox({ icon: Icon, size = 'sm' }: IconBoxProps) {
  return (
    <div
      className={cn('flex items-center justify-center rounded-lg bg-primary/10', sizeClasses[size])}
    >
      <Icon className="h-5 w-5 text-primary" />
    </div>
  );
}
