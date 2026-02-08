import { apiClient } from './client';
import type { UserProfile } from '@/types';

export const authApi = {
  getMe: () => apiClient.get<UserProfile>('/auth/me').then((r) => r.data),
  getSignupStatus: () =>
    apiClient
      .get<{ signupsEnabled: boolean; loginEnabled: boolean }>('/auth/signup-status')
      .then((r) => r.data),
};
