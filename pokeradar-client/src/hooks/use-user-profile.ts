import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api/users.api';
import { useAuth } from './use-auth';

export function useUserProfile() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['user-profile'],
    queryFn: usersApi.getProfile,
    enabled: isAuthenticated,
  });
}
