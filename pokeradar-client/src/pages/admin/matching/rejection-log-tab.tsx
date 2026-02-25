import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useAdminRejections } from '@/hooks/use-admin';
import type { RejectionReason } from '@/api/admin.api';

const REASON_LABELS: Record<RejectionReason, string> = {
  EXCLUDE_MATCH: 'Wykluczone słowo',
  MISSING_TOKEN: 'Brak tokenu',
  SCORE_TOO_LOW: 'Za niski wynik',
  LANGUAGE_FILTERED: 'Filtr językowy',
};

const REASON_VARIANT: Record<RejectionReason, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    EXCLUDE_MATCH: 'destructive',
    MISSING_TOKEN: 'secondary',
    SCORE_TOO_LOW: 'outline',
    LANGUAGE_FILTERED: 'default',
  };

export function RejectionLogTab() {
  const [page, setPage] = useState(1);
  const [productIdFilter, setProductIdFilter] = useState('');
  const [shopIdFilter, setShopIdFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState<string>('');
  const [appliedFilters, setAppliedFilters] = useState({ productId: '', shopId: '', reason: '' });

  const { data, isLoading } = useAdminRejections({
    productId: appliedFilters.productId || undefined,
    shopId: appliedFilters.shopId || undefined,
    reason: appliedFilters.reason || undefined,
    page,
    limit: 50,
  });

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedFilters({ productId: productIdFilter, shopId: shopIdFilter, reason: reasonFilter });
  };

  const handleClear = () => {
    setProductIdFilter('');
    setShopIdFilter('');
    setReasonFilter('');
    setAppliedFilters({ productId: '', shopId: '', reason: '' });
    setPage(1);
  };

  const hasFilters = appliedFilters.productId || appliedFilters.shopId || appliedFilters.reason;

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Tytuły odrzucone przez silnik dopasowań. Rekordy wygasają po 7 dniach.
      </p>

      <form onSubmit={handleFilter} className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
        <Input
          placeholder="ID produktu..."
          value={productIdFilter}
          onChange={(e) => setProductIdFilter(e.target.value)}
          className="w-full sm:w-48"
        />
        <Input
          placeholder="ID sklepu..."
          value={shopIdFilter}
          onChange={(e) => setShopIdFilter(e.target.value)}
          className="w-full sm:w-48"
        />
        <Select
          value={reasonFilter || 'all'}
          onValueChange={(v) => setReasonFilter(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Powód" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie powody</SelectItem>
            <SelectItem value="EXCLUDE_MATCH">Wykluczone słowo</SelectItem>
            <SelectItem value="MISSING_TOKEN">Brak tokenu</SelectItem>
            <SelectItem value="SCORE_TOO_LOW">Za niski wynik</SelectItem>
            <SelectItem value="LANGUAGE_FILTERED">Filtr językowy</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit">Filtruj</Button>
        {hasFilters && (
          <Button type="button" variant="outline" onClick={handleClear}>
            Wyczyść
          </Button>
        )}
      </form>

      <Card>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tytuł ze sklepu</TableHead>
                  <TableHead>Sklep</TableHead>
                  <TableHead>Produkt ID</TableHead>
                  <TableHead>Powód</TableHead>
                  <TableHead>Szczegóły</TableHead>
                  <TableHead className="text-right">Wystąpień</TableHead>
                  <TableHead>Ostatnio widziano</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data || data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Brak odrzuceń
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell
                        className="font-mono text-sm max-w-xs truncate"
                        title={event.rawTitle}
                      >
                        {event.rawTitle}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {event.shopId}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {event.productId}
                      </TableCell>
                      <TableCell>
                        <Badge variant={REASON_VARIANT[event.reason]}>
                          {REASON_LABELS[event.reason]}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-sm text-muted-foreground max-w-[200px] truncate"
                        title={event.details}
                      >
                        {event.details}
                      </TableCell>
                      <TableCell className="text-right text-sm">{event.occurrenceCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(event.lastSeenAt).toLocaleString('pl-PL')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
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
