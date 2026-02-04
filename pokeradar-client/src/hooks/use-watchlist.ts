import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { watchlistApi } from '@/api/watchlist.api';
import { useAuth } from './use-auth';
import type { AddWatchEntryRequest, UpdateWatchEntryRequest } from '@/types';

export function useWatchlist() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: watchlistApi.getAll,
    enabled: isAuthenticated,
  });
}

export function useAddWatchEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddWatchEntryRequest) => watchlistApi.add(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });
}

export function useUpdateWatchEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWatchEntryRequest }) =>
      watchlistApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });
}

export function useDeleteWatchEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => watchlistApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });
}
