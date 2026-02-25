import { apiClient } from './client';

// ===== TYPES =====

export interface AdminShopSummary {
  shopId: string;
  shopName: string;
  baseUrl: string;
  disabled: boolean;
  findsLastHour: number;
  availableLastHour: number;
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

export interface SearchOverride {
  additionalRequired?: string[];
  additionalForbidden?: string[];
  customPhrase?: string;
}

export interface AdminProduct {
  id: string;
  name: string;
  imageUrl: string;
  productSetId?: string;
  productTypeId?: string;
  disabled?: boolean;
  searchOverride?: SearchOverride;
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

export interface MatchingProfile {
  required: string[];
  forbidden: string[];
  synonyms?: Record<string, string>;
}

export interface ProductType {
  id: string;
  name: string;
  matchingProfile: MatchingProfile;
}

export interface AdminUserSearchItem {
  clerkId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  telegramLinked: boolean;
  discordLinked: boolean;
}

export interface AdminUserDetail {
  clerkId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  telegramLinked: boolean;
  telegramChannelId: string | null;
  discordLinked: boolean;
  discordChannelId: string | null;
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
    status: string;
    payload: {
      productName: string;
      shopName: string;
      price: number;
      maxPrice: number;
      productUrl: string;
    };
    createdAt: string;
  }>;
}

export interface AdminNotification {
  id: string;
  userId: string;
  userEmail: string;
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
  deliveries: Array<{
    channel: string;
    status: string;
    attempts: number;
    error: string | null;
    sentAt: string | null;
  }>;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ===== MATCHING TYPES =====

export type PendingMatchStatus = 'PENDING' | 'CONFIRMED' | 'CORRECTED' | 'REJECTED';
export type MatchBand = 'HIGH' | 'MEDIUM' | 'LOW';
export type PendingMatchSource = 'AUTO_MEDIUM' | 'AUTO_ML';

export interface PendingMatch {
  id: string;
  rawTitle: string;
  shopId: string;
  productId: string;
  confidence: number;
  phrase: string;
  status: PendingMatchStatus;
  source: PendingMatchSource;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

export type RejectionReason =
  | 'EXCLUDE_MATCH'
  | 'MISSING_TOKEN'
  | 'SCORE_TOO_LOW'
  | 'LANGUAGE_FILTERED';

export interface MatchRejectionEvent {
  id: string;
  rawTitle: string;
  shopId: string;
  productId: string;
  phrase: string;
  reason: RejectionReason;
  details: string;
  lastSeenAt: string;
  occurrenceCount: number;
  createdAt: string;
}

export type CorrectionReason = 'WRONG_TYPE' | 'WRONG_SET' | 'NON_ENGLISH' | 'FALSE_POSITIVE';

export interface ClassificationCorrection {
  id: string;
  rawTitle: string;
  shopId: string;
  originalProductId: string;
  correctedProductId: string;
  reason: CorrectionReason;
  correctedAt: string;
  adminId: string;
}

// ===== API CLIENT =====

export const adminApi = {
  // Shops
  getShops: () => apiClient.get<AdminShopSummary[]>('/admin/shops').then((r) => r.data),
  getShop: (shopId: string) =>
    apiClient.get<AdminShopDetail>(`/admin/shops/${shopId}`).then((r) => r.data),

  // Products
  getProducts: () => apiClient.get<AdminProduct[]>('/admin/products').then((r) => r.data),
  createProduct: (data: unknown) => apiClient.post('/admin/products', data).then((r) => r.data),
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
  getProductSets: () => apiClient.get<ProductSet[]>('/admin/product-sets').then((r) => r.data),
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
  getProductTypes: () => apiClient.get<ProductType[]>('/admin/product-types').then((r) => r.data),
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

  // Matching
  getReviewQueue: () =>
    apiClient.get<PendingMatch[]>('/admin/matching/review-queue').then((r) => r.data),
  getRejections: (params?: {
    productId?: string;
    shopId?: string;
    reason?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient
      .get<PaginatedResponse<MatchRejectionEvent>>('/admin/matching/rejections', { params })
      .then((r) => r.data),
  getCorrections: (params?: { page?: number; limit?: number }) =>
    apiClient
      .get<PaginatedResponse<ClassificationCorrection>>('/admin/matching/corrections', { params })
      .then((r) => r.data),
  confirmMatch: (matchId: string) =>
    apiClient.post(`/admin/matching/confirm/${matchId}`).then((r) => r.data),
  correctMatch: (matchId: string, data: { correctProductId: string; reason: CorrectionReason }) =>
    apiClient.post(`/admin/matching/correct/${matchId}`, data).then((r) => r.data),
  rejectMatch: (matchId: string, reason: 'NON_ENGLISH' | 'FALSE_POSITIVE') =>
    apiClient.post(`/admin/matching/reject/${matchId}`, { reason }).then((r) => r.data),
};
