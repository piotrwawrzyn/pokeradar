import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminSettings, useUpdateAdminSettings } from '@/hooks/use-admin';
import { toast } from 'sonner';

export function AdminSettingsPage() {
  const { data: settings, isLoading } = useAdminSettings();
  const updateSettings = useUpdateAdminSettings();

  const handleToggle = (field: 'signupsEnabled' | 'loginEnabled', value: boolean) => {
    updateSettings.mutate(
      { [field]: value },
      {
        onSuccess: () => {
          toast.success('Ustawienia zaktualizowane');
        },
        onError: () => {
          toast.error('Nie udało się zaktualizować ustawień');
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Ustawienia aplikacji</h1>
        <Card className="p-6 space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Ustawienia aplikacji</h1>
      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="signups">Rejestracja</Label>
            <p className="text-sm text-muted-foreground">
              Pozwól nowym użytkownikom na rejestrację przez Google
            </p>
          </div>
          <Switch
            id="signups"
            checked={settings?.signupsEnabled ?? false}
            onCheckedChange={(checked) => handleToggle('signupsEnabled', checked)}
            disabled={updateSettings.isPending}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="login">Logowanie</Label>
            <p className="text-sm text-muted-foreground">
              Pozwól istniejącym użytkownikom na logowanie (admini zawsze mogą się zalogować)
            </p>
          </div>
          <Switch
            id="login"
            checked={settings?.loginEnabled ?? false}
            onCheckedChange={(checked) => handleToggle('loginEnabled', checked)}
            disabled={updateSettings.isPending}
          />
        </div>
      </Card>
    </div>
  );
}
