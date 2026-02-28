import axios from 'axios';
import { getApiBaseUrl } from '@/lib/utils';

export const TOKEN_KEY = ''; // kept for import compat, unused

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await (window as any).Clerk?.session?.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
