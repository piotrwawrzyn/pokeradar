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
import { ExternalLink } from '@/components/ui/external-link';
import { BackButton } from '@/components/ui/back-button';
import { NotFound } from '@/components/admin/not-found';
import { StatCard } from '@/components/admin/stat-card';
import { StatusBadge } from '@/components/admin/status-badge';
import { useAdminShopDetail } from '@/hooks/use-admin';
import {
  Package,
  CheckCircle,
  AlertTriangle,
  ExternalLink as ExternalLinkIcon,
} from 'lucide-react';
import { formatDateTime, formatPLN } from '@/lib/format';

export function AdminShopDetailPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { data: shop, isLoading } = useAdminShopDetail(shopId!);

  if (isLoading) {
    return <PageLoader />;
  }

  if (!shop) {
    return <NotFound message="Sklep nie znaleziony" backTo="/admin/shops" />;
  }

  return (
    <div>
      <div className="mb-6">
        <BackButton to="/admin/shops" />
        <h1 className="text-2xl font-bold">{shop.shopName}</h1>
        <p className="text-muted-foreground">{shop.baseUrl}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <StatCard label="Wszystkie produkty" value={shop.totalCount} icon={Package} />
        <StatCard label="Dostępne produkty" value={shop.availableCount} icon={CheckCircle} />
      </div>

      {shop.hasWarning && (
        <Card className="p-4 mb-6 border-orange-500/50 bg-orange-500/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <div>
              <p className="font-medium">Ostrzeżenie</p>
              <p className="text-sm text-muted-foreground">
                Sklep nie zwrócił żadnych wyników w ostatniej godzinie
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produkt</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cena</TableHead>
              <TableHead>Ostatnio widziane</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shop.products.length === 0 ? (
              <EmptyTableRow colSpan={5} message="Brak wyników z ostatniej godziny" />
            ) : (
              shop.products
                .sort((a, b) => {
                  // Available products first
                  if (a.isAvailable && !b.isAvailable) return -1;
                  if (!a.isAvailable && b.isAvailable) return 1;

                  // Then sort by set release date (newest to oldest)
                  // Products without sets go to the end
                  if (a.setReleaseDate && !b.setReleaseDate) return -1;
                  if (!a.setReleaseDate && b.setReleaseDate) return 1;
                  if (a.setReleaseDate && b.setReleaseDate) {
                    return (
                      new Date(b.setReleaseDate).getTime() - new Date(a.setReleaseDate).getTime()
                    );
                  }

                  return 0;
                })
                .map((product) => (
                  <TableRow key={product.productId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.productImageUrl && (
                          <img
                            src={product.productImageUrl}
                            alt={product.productName}
                            className="h-10 w-10 rounded object-cover"
                          />
                        )}
                        <span className="font-medium">{product.productName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.isAvailable ? (
                        <StatusBadge status="ok" label="Dostępny" />
                      ) : (
                        <StatusBadge status="inactive" label="Niedostępny" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.price ? formatPLN(product.price) : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(product.lastSeen)}
                    </TableCell>
                    <TableCell>
                      {product.productUrl && (
                        <ExternalLink
                          href={product.productUrl}
                          className="text-blue-500 hover:text-blue-600"
                        >
                          <ExternalLinkIcon className="h-4 w-4" />
                        </ExternalLink>
                      )}
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
