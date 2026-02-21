export interface WatchlistEntryResponse {
  id: string;
  productId: string;
  maxPrice: number;
  createdAt: Date;
}

export interface ProductPriceResponse {
  shopId: string;
  price: number | null;
  isAvailable: boolean;
  productUrl: string;
  timestamp: Date;
}

export interface ChannelStatus {
  linked: boolean;
  linkToken: string | null;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  displayName: string;
  telegram: ChannelStatus;
  discord: ChannelStatus;
}

export interface LinkTokenResponse {
  linkToken: string;
}
