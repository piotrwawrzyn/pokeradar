import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface NotificationChannelCardProps {
  name: string;
  description: string;
  icon: LucideIcon;
  isLinked: boolean;
  isAvailable: boolean;
  children: ReactNode;
}

export function NotificationChannelCard({
  name,
  description,
  icon: Icon,
  isLinked,
  isAvailable,
  children,
}: NotificationChannelCardProps) {
  return (
    <Card className={!isAvailable ? 'opacity-60' : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          {isLinked && (
            <Badge variant="outline" className="border-green-500/30 text-green-500">
              Aktywny
            </Badge>
          )}
          {!isAvailable && <Badge variant="secondary">Wkrótce</Badge>}
        </div>
      </CardHeader>
      {isAvailable && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}
