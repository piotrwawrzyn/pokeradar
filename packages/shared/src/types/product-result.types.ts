/**
 * Scraping result for a product.
 * Canonical definition — imported by scrapper and API.
 */
export interface ProductResult {
  productId: string;
  shopId: string;
  productUrl: string;
  productTitle: string;
  price: number | null;
  isAvailable: boolean;
  timestamp: Date;
}
