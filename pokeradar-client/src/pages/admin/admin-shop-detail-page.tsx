import { useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatCard } from '@/components/admin/stat-card';
import { StatusBadge } from '@/components/admin/status-badge';
import { useAdminShopDetail } from '@/hooks/use-admin';
import { ArrowLeft, Package, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';

export function AdminShopDetailPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { data: shop, isLoading } = useAdminShopDetail(shopId!);

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Card className="p-6">
          <Skeleton className="h-96" />
        </Card>
      </div>
    );
  }

  if (!shop) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Sklep nie znaleziony</h1>
        <Link to="/admin/shops">
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
        <Link to="/admin/shops">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót do listy
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{shop.shopName}</h1>
        <p className="text-muted-foreground">{shop.baseUrl}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <StatCard
          label="Wszystkie produkty"
          value={shop.totalCount}
          icon={Package}
          variant="default"
        />
        <StatCard
          label="Dostępne produkty"
          value={shop.availableCount}
          icon={CheckCircle}
          variant="default"
        />
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
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Brak wyników z ostatniej godziny
                </TableCell>
              </TableRow>
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
                    return new Date(b.setReleaseDate).getTime() - new Date(a.setReleaseDate).getTime();
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
                    {product.price ? `${product.price.toFixed(2)} zł` : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(product.lastSeen).toLocaleString('pl-PL')}
                  </TableCell>
                  <TableCell>
                    {product.productUrl && (
                      <a
                        href={product.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
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
