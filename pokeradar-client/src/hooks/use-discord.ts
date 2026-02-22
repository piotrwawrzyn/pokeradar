import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users.api';

export function useGenerateDiscordToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.generateDiscordToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
  });
}

export function useUnlinkDiscord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.unlinkDiscord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
  });
}
