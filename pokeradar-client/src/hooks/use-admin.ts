import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { useAuth } from './use-auth';

// Admin identity check
export function useIsAdmin() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['admin', 'me'],
    queryFn: adminApi.checkAdmin,
    enabled: isAuthenticated,
    staleTime: Infinity, // Admin status doesn't change during session
  });
}

// Settings
export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: adminApi.getSettings,
  });
}

export function useUpdateAdminSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  });
}

// Shops
export function useAdminShops() {
  return useQuery({
    queryKey: ['admin', 'shops'],
    queryFn: adminApi.getShops,
  });
}

export function useAdminShopDetail(shopId: string) {
  return useQuery({
    queryKey: ['admin', 'shops', shopId],
    queryFn: () => adminApi.getShop(shopId),
    enabled: !!shopId,
  });
}

// Products
export function useAdminProducts() {
  return useQuery({
    queryKey: ['admin', 'products'],
    queryFn: adminApi.getProducts,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createProduct(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['products'] }); // Public cache
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateProduct(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUploadImageOnly() {
  return useMutation({
    mutationFn: ({ file }: { file: File }) => adminApi.uploadImageOnly(file),
  });
}

export function useUploadProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      adminApi.uploadProductImage(id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Product Sets
export function useAdminProductSets() {
  return useQuery({
    queryKey: ['admin', 'product-sets'],
    queryFn: adminApi.getProductSets,
  });
}

export function useCreateProductSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createProductSet(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'product-sets'] });
      qc.invalidateQueries({ queryKey: ['product-sets'] });
    },
  });
}

export function useUpdateProductSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateProductSet(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'product-sets'] });
      qc.invalidateQueries({ queryKey: ['product-sets'] });
    },
  });
}

export function useDeleteProductSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteProductSet(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'product-sets'] });
      qc.invalidateQueries({ queryKey: ['product-sets'] });
    },
  });
}

export function useUploadProductSetImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      adminApi.uploadProductSetImage(id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'product-sets'] });
      qc.invalidateQueries({ queryKey: ['product-sets'] });
    },
  });
}

// Product Types
export function useAdminProductTypes() {
  return useQuery({
    queryKey: ['admin', 'product-types'],
    queryFn: adminApi.getProductTypes,
  });
}

export function useCreateProductType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => adminApi.createProductType(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'product-types'] }),
  });
}

export function useUpdateProductType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      adminApi.updateProductType(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'product-types'] }),
  });
}

export function useDeleteProductType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteProductType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'product-types'] }),
  });
}

// Users
export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminApi.getUsers,
  });
}

export function useAdminUserDetail(userId: string) {
  return useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => adminApi.getUser(userId),
    enabled: !!userId,
  });
}

// Notifications
export function useAdminNotifications(params?: {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
}) {
  return useQuery({
    queryKey: ['admin', 'notifications', params],
    queryFn: () => adminApi.getNotifications(params),
  });
}
