import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiBaseUrl } from '@/lib/utils';

export function useLinkStatusStream(token: string | null, successMessage: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const connect = async () => {
      const authToken = await (window as any).Clerk?.session?.getToken();
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/users/me/link-status/stream`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.body || cancelled) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (!cancelled) {
        const { done, value } = await reader.read();
        const chunk = value ? decoder.decode(value) : '';
        if (done) break;
        if (chunk.includes('data: linked')) {
          queryClient.invalidateQueries({ queryKey: ['user-profile'] });
          toast.success(successMessage);
          break;
        }
      }

      reader.cancel();
    };

    connect().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [token]);
}
