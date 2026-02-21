import { apiClient } from './client';
import type { UserProfile, LinkToken } from '@/types';

export const usersApi = {
  getProfile: () =>
    apiClient.get<UserProfile>('/users/me').then((r) => r.data),
  generateTelegramToken: () =>
    apiClient
      .post<LinkToken>('/users/me/telegram/link-token')
      .then((r) => r.data),
  unlinkTelegram: () => apiClient.delete('/users/me/telegram'),
  generateDiscordToken: () =>
    apiClient
      .post<LinkToken>('/users/me/discord/link-token')
      .then((r) => r.data),
  unlinkDiscord: () => apiClient.delete('/users/me/discord'),
};
