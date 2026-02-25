import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReviewQueueTab } from './matching/review-queue-tab';
import { RejectionLogTab } from './matching/rejection-log-tab';
import { CorrectionHistoryTab } from './matching/correction-history-tab';
import { useAdminReviewQueue } from '@/hooks/use-admin';
import { Badge } from '@/components/ui/badge';

function ReviewQueueBadge() {
  const { data } = useAdminReviewQueue();
  const count = data?.length ?? 0;
  if (count === 0) return null;
  return (
    <Badge variant="destructive" className="ml-2 h-5 min-w-5 text-xs px-1.5">
      {count}
    </Badge>
  );
}

export function AdminMatchingPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dopasowania</h1>

      <Tabs defaultValue="review-queue">
        <TabsList className="mb-6">
          <TabsTrigger value="review-queue" className="flex items-center">
            Kolejka weryfikacji
            <ReviewQueueBadge />
          </TabsTrigger>
          <TabsTrigger value="rejections">Odrzucenia</TabsTrigger>
          <TabsTrigger value="corrections">Historia korekt</TabsTrigger>
        </TabsList>

        <TabsContent value="review-queue">
          <ReviewQueueTab />
        </TabsContent>

        <TabsContent value="rejections">
          <RejectionLogTab />
        </TabsContent>

        <TabsContent value="corrections">
          <CorrectionHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
