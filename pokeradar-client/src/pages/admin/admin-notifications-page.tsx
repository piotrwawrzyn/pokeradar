import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/admin/status-badge';
import { useAdminNotifications } from '@/hooks/use-admin';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

export function AdminNotificationsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [status, setStatus] = useState<string>('');
  const [userSearch, setUserSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data, isLoading } = useAdminNotifications({
    page,
    limit,
    status: status || undefined,
    userId: userSearch || undefined,
  });

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStatusChange = (value: string) => {
    setStatus(value === 'all' ? '' : value);
    setPage(1);
  };

  const handleUserSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Powiadomienia</h1>
        <Card className="p-6">
          <div className="flex gap-4 mb-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 flex-1" />
          </div>
          <Skeleton className="h-96" />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Powiadomienia</h1>

      <Card className="p-6 mb-6">
        <form onSubmit={handleUserSearchSubmit} className="flex gap-4">
          <Select value={status || 'all'} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="pending">Oczekujące</SelectItem>
              <SelectItem value="sent">Wysłane</SelectItem>
              <SelectItem value="failed">Błąd</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Szukaj po ID użytkownika..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">Filtruj</Button>
            {(status || userSearch) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStatus('');
                  setUserSearch('');
                  setPage(1);
                }}
              >
                Wyczyść
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Email użytkownika</TableHead>
              <TableHead>Produkt</TableHead>
              <TableHead>Sklep</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cena</TableHead>
              <TableHead className="text-center">Próby</TableHead>
              <TableHead>Wysłano</TableHead>
              <TableHead>Utworzono</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data || data.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Brak powiadomień
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((notif) => {
                const isExpanded = expandedRows.has(notif.id);
                return (
                  <>
                    <TableRow key={notif.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell onClick={() => toggleRow(notif.id)}>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{notif.userEmail}</TableCell>
                      <TableCell>{notif.payload.productName}</TableCell>
                      <TableCell>{notif.payload.shopName}</TableCell>
                      <TableCell>
                        {notif.status === 'sent' && <StatusBadge status="sent" />}
                        {notif.status === 'pending' && <StatusBadge status="pending" />}
                        {notif.status === 'failed' && <StatusBadge status="failed" />}
                      </TableCell>
                      <TableCell className="text-right">
                        {notif.payload.price.toFixed(2)} zł
                      </TableCell>
                      <TableCell className="text-center">{notif.attempts}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {notif.sentAt
                          ? new Date(notif.sentAt).toLocaleString('pl-PL')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(notif.createdAt).toLocaleString('pl-PL')}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/30">
                          <div className="p-4 space-y-3">
                            <div>
                              <p className="text-sm font-semibold mb-2">Szczegóły payload:</p>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Produkt ID:</span>{' '}
                                  <span className="font-mono">{notif.payload.productId}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Sklep ID:</span>{' '}
                                  <span className="font-mono">{notif.payload.shopId}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Maksymalna cena:</span>{' '}
                                  {notif.payload.maxPrice.toFixed(2)} zł
                                </div>
                                <div>
                                  <span className="text-muted-foreground">URL produktu:</span>{' '}
                                  <a
                                    href={notif.payload.productUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline"
                                  >
                                    Link
                                  </a>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Użytkownik ID:</span>{' '}
                                  <span className="font-mono">{notif.userId}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Kanał:</span>{' '}
                                  {notif.channel}
                                </div>
                              </div>
                            </div>
                            {notif.error && (
                              <div>
                                <p className="text-sm font-semibold mb-1 text-red-500">
                                  Błąd:
                                </p>
                                <p className="text-sm font-mono bg-red-950/30 text-red-400 p-2 rounded">
                                  {notif.error}
                                </p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              Strona {data.page} z {data.totalPages} (łącznie: {data.total} powiadomień)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Poprzednia
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={data.page === data.totalPages}
              >
                Następna
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
