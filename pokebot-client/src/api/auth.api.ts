import { apiClient } from './client';
import type { UserProfile } from '@/types';

export const authApi = {
  getMe: () => apiClient.get<UserProfile>('/auth/me').then((r) => r.data),
};
