import { apiClient } from './client';
import type { ProductSet } from '@/types';

export const productSetsApi = {
  getAll: () => apiClient.get<ProductSet[]>('/product-sets').then((r) => r.data),
};
