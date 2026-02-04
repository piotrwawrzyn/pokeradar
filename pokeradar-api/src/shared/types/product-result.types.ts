export interface ProductResult {
  productId: string;
  shopId: string;
  productUrl: string;
  price: number | null;
  isAvailable: boolean;
  timestamp: Date;
}
