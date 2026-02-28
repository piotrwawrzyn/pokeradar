import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageLoader } from '@/components/ui/page-loader';
import { EmptyTableRow } from '@/components/ui/empty-table-row';
import { BackButton } from '@/components/ui/back-button';
import { NotFound } from '@/components/admin/not-found';
import { StatusBadge } from '@/components/admin/status-badge';
import { useAdminUserDetail } from '@/hooks/use-admin';
import { formatDateTime, formatPLN } from '@/lib/format';

export function AdminUserDetailPage() {
  const { clerkId } = useParams<{ clerkId: string }>();
  const { data: user, isLoading } = useAdminUserDetail(clerkId!);

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return <NotFound message="Użytkownik nie znaleziony" backTo="/admin/users" />;
  }

  return (
    <div>
      <div className="mb-6">
        <BackButton to="/admin/users" />
        <h1 className="text-2xl font-bold">{user.displayName}</h1>
        <p className="text-muted-foreground">{user.email}</p>
      </div>

      <div className="space-y-6">
        {/* Profile Info */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Informacje o profilu</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Clerk ID</p>
              <p className="font-mono text-sm break-all">{user.clerkId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {user.isAdmin && <StatusBadge status="ok" label="Admin" />}
                {user.telegramLinked ? (
                  <StatusBadge status="ok" label="Telegram" />
                ) : (
                  <StatusBadge status="inactive" label="Brak Telegram" />
                )}
                {user.discordLinked ? (
                  <StatusBadge status="ok" label="Discord" />
                ) : (
                  <StatusBadge status="inactive" label="Brak Discord" />
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ostatnie logowanie</p>
              <p className="text-sm">{user.lastLogin ? formatDateTime(user.lastLogin) : 'Nigdy'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data rejestracji</p>
              <p className="text-sm">{formatDateTime(user.createdAt)}</p>
            </div>
            {user.telegramChannelId && (
              <div>
                <p className="text-sm text-muted-foreground">Telegram Channel ID</p>
                <p className="font-mono text-sm break-all">{user.telegramChannelId}</p>
              </div>
            )}
            {user.discordChannelId && (
              <div>
                <p className="text-sm text-muted-foreground">Discord User ID</p>
                <p className="font-mono text-sm break-all">{user.discordChannelId}</p>
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
          <div className="overflow-x-auto">
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
                  <EmptyTableRow colSpan={3} message="Brak produktów na watchliście" />
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
                      <TableCell className="text-right">{formatPLN(entry.maxPrice)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Notifications */}
        <Card>
          <div className="p-6 pb-0">
            <h2 className="text-lg font-semibold mb-4">
              Powiadomienia ({user.notifications.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
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
                  <EmptyTableRow colSpan={5} message="Brak powiadomień" />
                ) : (
                  user.notifications.map((notif) => (
                    <TableRow key={notif.id}>
                      <TableCell className="font-medium">{notif.payload.productName}</TableCell>
                      <TableCell>{notif.payload.shopName}</TableCell>
                      <TableCell>
                        {notif.status === 'sent' && <StatusBadge status="sent" />}
                        {notif.status === 'pending' && <StatusBadge status="pending" />}
                        {notif.status === 'failed' && <StatusBadge status="failed" />}
                      </TableCell>
                      <TableCell className="text-right">{formatPLN(notif.payload.price)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(notif.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
