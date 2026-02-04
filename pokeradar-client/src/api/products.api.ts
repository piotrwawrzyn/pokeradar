import { apiClient } from './client';
import type { Product } from '@/types';

export const productsApi = {
  getAll: () => apiClient.get<Product[]>('/products').then((r) => r.data),
  getById: (id: string) =>
    apiClient.get<Product>(`/products/${id}`).then((r) => r.data),
};
