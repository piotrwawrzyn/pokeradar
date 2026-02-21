import { AuthGuard } from '@/components/auth/auth-guard';
import { useAuth } from '@/hooks/use-auth';
import { NotificationChannelList } from '@/components/notifications/notification-channel-list';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { User } from 'lucide-react';

function SettingsContent() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Ustawienia</h1>
        <p className="text-muted-foreground mt-1">Zarządzaj swoim profilem i powiadomieniami.</p>
      </div>

      {/* Profile Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="h-5 w-5" />
          Profil
        </h2>
        <Card>
          <CardContent className="p-6 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Nazwa</p>
              <p className="font-medium">{user?.displayName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Notifications Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">Powiadomienia</h2>
        <NotificationChannelList />
      </section>
    </div>
  );
}

export function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
