import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/admin/status-badge';
import { useAdminUsers } from '@/hooks/use-admin';

export function AdminUsersPage() {
  const { data: users, isLoading } = useAdminUsers();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Użytkownicy</h1>
        <Card>
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Użytkownicy</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Użytkownik</TableHead>
              <TableHead>Telegram</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Watchlista</TableHead>
              <TableHead>Ostatnie logowanie</TableHead>
              <TableHead>Data rejestracji</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow
                key={user.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => navigate(`/admin/users/${user.id}`)}
              >
                <TableCell className="align-middle">
                  <div>
                    <div className="font-medium">{user.displayName}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </div>
                </TableCell>
                <TableCell className="align-middle">
                  {user.telegramLinked ? (
                    <StatusBadge status="ok" label="Połączony" />
                  ) : (
                    <StatusBadge status="inactive" label="Brak" />
                  )}
                </TableCell>
                <TableCell className="align-middle">
                  {user.isAdmin && <StatusBadge status="ok" label="Admin" />}
                </TableCell>
                <TableCell className="align-middle">{user.watchlistCount}</TableCell>
                <TableCell className="text-sm text-muted-foreground align-middle">
                  {user.lastLogin
                    ? new Date(user.lastLogin).toLocaleString('pl-PL')
                    : 'Nigdy'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground align-middle">
                  {new Date(user.createdAt).toLocaleDateString('pl-PL')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
