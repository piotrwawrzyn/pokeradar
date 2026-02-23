import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users.api';
import type { UserProfile } from '@/types';

export function useGenerateTelegramToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.generateTelegramToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
  });
}

export function useUnlinkTelegram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.unlinkTelegram,
    onSuccess: () => {
      queryClient.setQueryData(['user-profile'], (prev: UserProfile | undefined) =>
        prev ? { ...prev, telegram: { ...prev.telegram, linked: false } } : prev,
      );
    },
  });
}
