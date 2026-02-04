import { apiClient } from './client';
import type {
  WatchlistEntry,
  AddWatchEntryRequest,
  UpdateWatchEntryRequest,
} from '@/types';

export const watchlistApi = {
  getAll: () =>
    apiClient.get<WatchlistEntry[]>('/watchlist').then((r) => r.data),
  add: (data: AddWatchEntryRequest) =>
    apiClient.post<WatchlistEntry>('/watchlist', data).then((r) => r.data),
  update: (id: string, data: UpdateWatchEntryRequest) =>
    apiClient.patch<WatchlistEntry>(`/watchlist/${id}`, data).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/watchlist/${id}`),
};
