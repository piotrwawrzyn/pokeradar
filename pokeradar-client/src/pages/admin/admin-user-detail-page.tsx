import { useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/admin/status-badge';
import { useAdminUserDetail } from '@/hooks/use-admin';
import { ArrowLeft, Loader2 } from 'lucide-react';

export function AdminUserDetailPage() {
  const { clerkId } = useParams<{ clerkId: string }>();
  const { data: user, isLoading } = useAdminUserDetail(clerkId!);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Użytkownik nie znaleziony</h1>
        <Link to="/admin/users">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/admin/users">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót do listy
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{user.displayName}</h1>
        <p className="text-muted-foreground">{user.email}</p>
      </div>

      <div className="space-y-6">
        {/* Profile Info */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Informacje o profilu</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Clerk ID</p>
              <p className="font-mono text-sm">{user.clerkId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex gap-2 mt-1">
                {user.isAdmin && <StatusBadge status="ok" label="Admin" />}
                {user.telegramLinked ? (
                  <StatusBadge status="ok" label="Telegram" />
                ) : (
                  <StatusBadge status="inactive" label="Brak Telegram" />
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ostatnie logowanie</p>
              <p className="text-sm">
                {user.lastLogin
                  ? new Date(user.lastLogin).toLocaleString('pl-PL')
                  : 'Nigdy'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data rejestracji</p>
              <p className="text-sm">
                {new Date(user.createdAt).toLocaleString('pl-PL')}
              </p>
            </div>
            {user.telegramChatId && (
              <div>
                <p className="text-sm text-muted-foreground">Telegram Chat ID</p>
                <p className="font-mono text-sm">{user.telegramChatId}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Watchlist */}
        <Card>
          <div className="p-6 pb-0">
            <h2 className="text-lg font-semibold mb-4">
              Watchlista ({user.watchlistEntries.length})
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produkt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Maksymalna cena</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.watchlistEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Brak produktów na watchliście
                  </TableCell>
                </TableRow>
              ) : (
                user.watchlistEntries.map((entry, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{entry.productName}</TableCell>
                    <TableCell>
                      {entry.isActive ? (
                        <StatusBadge status="active" />
                      ) : (
                        <StatusBadge status="inactive" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.maxPrice.toFixed(2)} zł
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Notifications */}
        <Card>
          <div className="p-6 pb-0">
            <h2 className="text-lg font-semibold mb-4">
              Powiadomienia ({user.notifications.length})
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produkt</TableHead>
                <TableHead>Sklep</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Cena</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.notifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Brak powiadomień
                  </TableCell>
                </TableRow>
              ) : (
                user.notifications.map((notif) => (
                  <TableRow key={notif.id}>
                    <TableCell className="font-medium">
                      {notif.payload.productName}
                    </TableCell>
                    <TableCell>{notif.payload.shopName}</TableCell>
                    <TableCell>
                      {notif.status === 'sent' && <StatusBadge status="sent" />}
                      {notif.status === 'pending' && <StatusBadge status="pending" />}
                      {notif.status === 'failed' && <StatusBadge status="failed" />}
                    </TableCell>
                    <TableCell className="text-right">
                      {notif.payload.price.toFixed(2)} zł
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(notif.createdAt).toLocaleString('pl-PL')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
