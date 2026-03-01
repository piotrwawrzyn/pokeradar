import { apiClient } from './client';
import type { UserProfile, LinkToken, UnlinkResult } from '@/types';

export const usersApi = {
  getProfile: () => apiClient.get<UserProfile>('/users/me').then((r) => r.data),
  generateTelegramToken: () =>
    apiClient.post<LinkToken>('/users/me/telegram/link-token').then((r) => r.data),
  unlinkTelegram: () => apiClient.delete<UnlinkResult>('/users/me/telegram').then((r) => r.data),
  generateDiscordToken: () =>
    apiClient.post<LinkToken>('/users/me/discord/link-token').then((r) => r.data),
  unlinkDiscord: () => apiClient.delete<UnlinkResult>('/users/me/discord').then((r) => r.data),
};
