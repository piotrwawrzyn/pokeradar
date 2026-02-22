import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users.api';

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
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
  });
}
