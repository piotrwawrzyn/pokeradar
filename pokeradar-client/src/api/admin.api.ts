import { apiClient } from './client';

// ===== TYPES =====

export interface AdminShopSummary {
  shopId: string;
  shopName: string;
  baseUrl: string;
  disabled: boolean;
  findsLastHour: number;
  findsLastWeek: number;
  hasWarning: boolean;
}

export interface AdminShopProduct {
  productId: string;
  productName: string;
  productImageUrl: string;
  productSetId: string | null;
  setReleaseDate: string | null;
  price: number | null;
  isAvailable: boolean;
  productUrl: string;
  lastSeen: string;
}

export interface AdminShopDetail {
  shopId: string;
  shopName: string;
  baseUrl: string;
  findsLastHour: number;
  findsLastWeek: number;
  availableCount: number;
  totalCount: number;
  hasWarning: boolean;
  products: AdminShopProduct[];
}

export interface AdminProductShopFind {
  shopId: string;
  shopName: string;
  price: number | null;
  isAvailable: boolean;
  productUrl: string;
  timestamp: string;
}

export interface AdminProduct {
  id: string;
  name: string;
  imageUrl: string;
  productSetId?: string;
  productTypeId?: string;
  disabled?: boolean;
  search?: { phrases?: string[]; exclude?: string[]; override?: boolean };
  price?: { max: number; min?: number };
  shopFinds: AdminProductShopFind[];
  bestPrice: number | null;
}

export interface ProductSet {
  id: string;
  name: string;
  series: string;
  imageUrl: string;
  releaseDate?: string;
}

export interface ProductType {
  id: string;
  name: string;
  search: { phrases?: string[]; exclude?: string[] };
}

export interface AdminUserSearchItem {
  clerkId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  telegramLinked: boolean;
}

export interface AdminUserDetail {
  clerkId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  telegramLinked: boolean;
  telegramChatId: string | null;
  lastLogin: string | null;
  createdAt: string;
  watchlistCount: number;
  watchlistEntries: Array<{
    productId: string;
    productName: string;
    maxPrice: number;
    isActive: boolean;
  }>;
  notifications: Array<{
    id: string;
    channel: string;
    status: string;
    payload: {
      productName: string;
      shopName: string;
      price: number;
      maxPrice: number;
      productUrl: string;
    };
    sentAt: string | null;
    createdAt: string;
    error: string | null;
  }>;
}

export interface AdminNotification {
  id: string;
  userId: string;
  userEmail: string;
  channel: string;
  status: string;
  payload: {
    productName: string;
    shopName: string;
    shopId: string;
    productId: string;
    price: number;
    maxPrice: number;
    productUrl: string;
  };
  attempts: number;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ===== API CLIENT =====

export const adminApi = {
  // Shops
  getShops: () =>
    apiClient.get<AdminShopSummary[]>('/admin/shops').then((r) => r.data),
  getShop: (shopId: string) =>
    apiClient.get<AdminShopDetail>(`/admin/shops/${shopId}`).then((r) => r.data),

  // Products
  getProducts: () =>
    apiClient.get<AdminProduct[]>('/admin/products').then((r) => r.data),
  createProduct: (data: unknown) =>
    apiClient.post('/admin/products', data).then((r) => r.data),
  updateProduct: (id: string, data: unknown) =>
    apiClient.patch(`/admin/products/${id}`, data).then((r) => r.data),
  deleteProduct: (id: string) => apiClient.delete(`/admin/products/${id}`),
  uploadImageOnly: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return apiClient
      .post<{ imageUrl: string }>('/admin/products/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  uploadProductImage: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return apiClient
      .post<{ imageUrl: string }>(`/admin/products/${id}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  // Product Sets
  getProductSets: () =>
    apiClient.get<ProductSet[]>('/admin/product-sets').then((r) => r.data),
  uploadSetImageOnly: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return apiClient
      .post<{ imageUrl: string }>('/admin/product-sets/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  createProductSet: (data: unknown) =>
    apiClient.post('/admin/product-sets', data).then((r) => r.data),
  updateProductSet: (id: string, data: unknown) =>
    apiClient.patch(`/admin/product-sets/${id}`, data).then((r) => r.data),
  deleteProductSet: (id: string) => apiClient.delete(`/admin/product-sets/${id}`),
  uploadProductSetImage: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return apiClient
      .post<{ imageUrl: string }>(`/admin/product-sets/${id}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  // Product Types
  getProductTypes: () =>
    apiClient.get<ProductType[]>('/admin/product-types').then((r) => r.data),
  createProductType: (data: unknown) =>
    apiClient.post('/admin/product-types', data).then((r) => r.data),
  updateProductType: (id: string, data: unknown) =>
    apiClient.patch(`/admin/product-types/${id}`, data).then((r) => r.data),
  deleteProductType: (id: string) => apiClient.delete(`/admin/product-types/${id}`),

  // Users
  searchUsers: (query: string) =>
    apiClient
      .get<AdminUserSearchItem[]>('/admin/users', { params: { search: query } })
      .then((r) => r.data),
  getUser: (clerkId: string) =>
    apiClient.get<AdminUserDetail>(`/admin/users/${clerkId}`).then((r) => r.data),

  // Notifications
  getNotifications: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
  }) =>
    apiClient
      .get<PaginatedResponse<AdminNotification>>('/admin/notifications', { params })
      .then((r) => r.data),
};
