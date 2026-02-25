import { useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Loader2, Check, X, Edit } from 'lucide-react';
import {
  useAdminReviewQueue,
  useConfirmMatch,
  useCorrectMatch,
  useRejectMatch,
} from '@/hooks/use-admin';
import { useAdminProducts } from '@/hooks/use-admin';
import type { PendingMatch, CorrectionReason } from '@/api/admin.api';

type RejectReason = 'NON_ENGLISH' | 'FALSE_POSITIVE';

export function ReviewQueueTab() {
  const { data: queue, isLoading } = useAdminReviewQueue();
  const { data: allProducts } = useAdminProducts();
  const confirmMutation = useConfirmMatch();
  const correctMutation = useCorrectMatch();
  const rejectMutation = useRejectMatch();

  const [correctDialog, setCorrectDialog] = useState<PendingMatch | null>(null);
  const [rejectDialog, setRejectDialog] = useState<PendingMatch | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedCorrectionReason, setSelectedCorrectionReason] =
    useState<CorrectionReason>('WRONG_TYPE');
  const [selectedRejectReason, setSelectedRejectReason] = useState<RejectReason>('NON_ENGLISH');

  const handleConfirm = async (match: PendingMatch) => {
    try {
      await confirmMutation.mutateAsync(match.id);
      toast.success('Dopasowanie potwierdzone');
    } catch {
      toast.error('Błąd potwierdzania dopasowania');
    }
  };

  const handleCorrect = async () => {
    if (!correctDialog || !selectedProductId) return;
    try {
      await correctMutation.mutateAsync({
        matchId: correctDialog.id,
        correctProductId: selectedProductId,
        reason: selectedCorrectionReason,
      });
      toast.success('Korekta zapisana');
      setCorrectDialog(null);
      setSelectedProductId('');
    } catch {
      toast.error('Błąd zapisu korekty');
    }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    try {
      await rejectMutation.mutateAsync({ matchId: rejectDialog.id, reason: selectedRejectReason });
      toast.success('Odrzucono');
      setRejectDialog(null);
    } catch {
      toast.error('Błąd odrzucania');
    }
  };

  const openCorrectDialog = (match: PendingMatch) => {
    setCorrectDialog(match);
    setSelectedProductId(match.productId);
    setSelectedCorrectionReason('WRONG_TYPE');
  };

  const openRejectDialog = (match: PendingMatch) => {
    setRejectDialog(match);
    setSelectedRejectReason('NON_ENGLISH');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const confidenceBadgeVariant = (confidence: number) => {
    if (confidence >= 90) return 'default';
    if (confidence >= 65) return 'secondary';
    return 'destructive';
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Dopasowania o średniej pewności wymagające weryfikacji. Odświeżane co 30 sekund.
      </p>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tytuł ze sklepu</TableHead>
                <TableHead>Sklep</TableHead>
                <TableHead>Dopasowany produkt</TableHead>
                <TableHead>Fraza</TableHead>
                <TableHead className="text-right">Pewność</TableHead>
                <TableHead>Źródło</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!queue || queue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Brak oczekujących dopasowań
                  </TableCell>
                </TableRow>
              ) : (
                queue.map((match) => {
                  const product = allProducts?.find((p) => p.id === match.productId);
                  return (
                    <TableRow key={match.id}>
                      <TableCell
                        className="font-mono text-sm max-w-xs truncate"
                        title={match.rawTitle}
                      >
                        {match.rawTitle}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {match.shopId}
                      </TableCell>
                      <TableCell className="text-sm">
                        {product?.name ?? (
                          <span className="text-muted-foreground font-mono">{match.productId}</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="font-mono text-xs text-muted-foreground max-w-[200px] truncate"
                        title={match.phrase}
                      >
                        {match.phrase}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={confidenceBadgeVariant(match.confidence)}>
                          {match.confidence.toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {match.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(match.createdAt).toLocaleString('pl-PL')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-500 hover:text-green-600"
                            onClick={() => handleConfirm(match)}
                            disabled={confirmMutation.isPending}
                            title="Potwierdź"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openCorrectDialog(match)}
                            title="Popraw"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => openRejectDialog(match)}
                            title="Odrzuć"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Correct dialog */}
      <Dialog open={!!correctDialog} onOpenChange={(open) => !open && setCorrectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Popraw dopasowanie</DialogTitle>
          </DialogHeader>
          {correctDialog && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tytuł ze sklepu:</p>
                <p className="font-mono text-sm bg-muted px-3 py-2 rounded">
                  {correctDialog.rawTitle}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prawidłowy produkt</label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz produkt..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allProducts?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Powód korekty</label>
                <Select
                  value={selectedCorrectionReason}
                  onValueChange={(v) => setSelectedCorrectionReason(v as CorrectionReason)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WRONG_TYPE">Zły typ produktu</SelectItem>
                    <SelectItem value="WRONG_SET">Zły zestaw</SelectItem>
                    <SelectItem value="NON_ENGLISH">Nie-angielski</SelectItem>
                    <SelectItem value="FALSE_POSITIVE">Fałszywy pozytyw</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectDialog(null)}>
              Anuluj
            </Button>
            <Button
              onClick={handleCorrect}
              disabled={!selectedProductId || correctMutation.isPending}
            >
              {correctMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Zapisz korektę
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Odrzuć dopasowanie</DialogTitle>
          </DialogHeader>
          {rejectDialog && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tytuł ze sklepu:</p>
                <p className="font-mono text-sm bg-muted px-3 py-2 rounded">
                  {rejectDialog.rawTitle}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Powód odrzucenia</label>
                <Select
                  value={selectedRejectReason}
                  onValueChange={(v) => setSelectedRejectReason(v as RejectReason)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NON_ENGLISH">Nie-angielski (japoński/koreański)</SelectItem>
                    <SelectItem value="FALSE_POSITIVE">Fałszywy pozytyw</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Odrzuć
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
