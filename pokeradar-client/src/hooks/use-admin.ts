import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { adminApi } from '@/api/admin.api';

// Admin identity check — reads from Clerk publicMetadata (no API call)
export function useIsAdmin() {
  const { user, isLoaded } = useUser();
  return {
    data: (user?.publicMetadata as any)?.isAdmin === true,
    isLoading: !isLoaded,
  };
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

export function useUploadSetImageOnly() {
  return useMutation({
    mutationFn: ({ file }: { file: File }) => adminApi.uploadSetImageOnly(file),
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
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'product-types'] });
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Users
export function useAdminUserSearch(query: string) {
  return useQuery({
    queryKey: ['admin', 'users', 'search', query],
    queryFn: () => adminApi.searchUsers(query),
    enabled: query.trim().length > 0,
  });
}

export function useAdminUserDetail(clerkId: string) {
  return useQuery({
    queryKey: ['admin', 'users', clerkId],
    queryFn: () => adminApi.getUser(clerkId),
    enabled: !!clerkId,
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
