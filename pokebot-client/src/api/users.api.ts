import { apiClient } from './client';
import type { UserProfile, TelegramLinkToken } from '@/types';

export const usersApi = {
  getProfile: () =>
    apiClient.get<UserProfile>('/users/me').then((r) => r.data),
  generateTelegramToken: () =>
    apiClient
      .post<TelegramLinkToken>('/users/me/telegram/link-token')
      .then((r) => r.data),
  unlinkTelegram: () => apiClient.delete('/users/me/telegram'),
};
