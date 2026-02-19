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

export interface UserProfileResponse {
  id: string;
  email: string;
  displayName: string;
  telegramLinked: boolean;
  telegramLinkToken: string | null;
}

export interface TelegramLinkTokenResponse {
  telegramLinkToken: string;
}
