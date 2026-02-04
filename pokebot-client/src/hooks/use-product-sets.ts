import { useQuery } from '@tanstack/react-query';
import { productSetsApi } from '@/api/product-sets.api';

export function useProductSets() {
  return useQuery({
    queryKey: ['product-sets'],
    queryFn: productSetsApi.getAll,
  });
}
