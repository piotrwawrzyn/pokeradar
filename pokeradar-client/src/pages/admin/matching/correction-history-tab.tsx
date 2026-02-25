import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useAdminCorrections } from '@/hooks/use-admin';
import { useAdminProducts } from '@/hooks/use-admin';
import type { CorrectionReason } from '@/api/admin.api';

const REASON_LABELS: Record<CorrectionReason, string> = {
  WRONG_TYPE: 'Zły typ',
  WRONG_SET: 'Zły zestaw',
  NON_ENGLISH: 'Nie-angielski',
  FALSE_POSITIVE: 'Fałszywy pozytyw',
};

export function CorrectionHistoryTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminCorrections({ page, limit: 50 });
  const { data: allProducts } = useAdminProducts();

  const getProductName = (id: string) => allProducts?.find((p) => p.id === id)?.name ?? id;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Historia korekt dopasowań dokonanych przez administratorów.
      </p>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tytuł ze sklepu</TableHead>
                <TableHead>Sklep</TableHead>
                <TableHead>Błędny produkt</TableHead>
                <TableHead>Poprawiony na</TableHead>
                <TableHead>Powód</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data || data.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Brak historii korekt
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((correction) => (
                  <TableRow key={correction.id}>
                    <TableCell
                      className="font-mono text-sm max-w-xs truncate"
                      title={correction.rawTitle}
                    >
                      {correction.rawTitle}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {correction.shopId}
                    </TableCell>
                    <TableCell className="text-sm text-red-400">
                      {getProductName(correction.originalProductId)}
                    </TableCell>
                    <TableCell className="text-sm text-green-400">
                      {getProductName(correction.correctedProductId)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{REASON_LABELS[correction.reason]}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {correction.adminId}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(correction.correctedAt).toLocaleString('pl-PL')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-4 border-t">
            <p className="text-sm text-muted-foreground">
              Strona {data.page} z {data.totalPages} (łącznie: {data.total})
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
