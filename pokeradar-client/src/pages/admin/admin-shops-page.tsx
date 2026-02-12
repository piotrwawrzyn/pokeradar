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
import { useAdminShops } from '@/hooks/use-admin';
import { AlertTriangle } from 'lucide-react';

export function AdminShopsPage() {
  const { data: shops, isLoading } = useAdminShops();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Sklepy</h1>
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

  // Sort shops: warning first, then OK, then inactive
  const sortedShops = [...(shops || [])].sort((a, b) => {
    if (a.disabled && !b.disabled) return 1;
    if (!a.disabled && b.disabled) return -1;
    if (!a.disabled && !b.disabled) {
      if (a.hasWarning && !b.hasWarning) return -1;
      if (!a.hasWarning && b.hasWarning) return 1;
    }
    return 0;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Sklepy</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nazwa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Znalezione produkty (1h)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedShops.map((shop) => (
              <TableRow
                key={shop.shopId}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => navigate(`/admin/shops/${shop.shopId}`)}
              >
                <TableCell className="font-medium">
                  <div>
                    <div className="flex items-center gap-2">
                      {shop.shopName}
                      {shop.hasWarning && (
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{shop.baseUrl}</div>
                  </div>
                </TableCell>
                <TableCell>
                  {shop.disabled ? (
                    <StatusBadge status="inactive" />
                  ) : shop.hasWarning ? (
                    <StatusBadge status="warning" />
                  ) : (
                    <StatusBadge status="ok" />
                  )}
                </TableCell>
                <TableCell className="text-right">{shop.findsLastHour}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
