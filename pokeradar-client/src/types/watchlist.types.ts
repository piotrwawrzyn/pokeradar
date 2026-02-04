export interface WatchlistEntry {
  id: string;
  productId: string;
  maxPrice: number;
  createdAt: string;
}

export interface AddWatchEntryRequest {
  productId: string;
  maxPrice: number;
}

export interface UpdateWatchEntryRequest {
  maxPrice: number;
}
