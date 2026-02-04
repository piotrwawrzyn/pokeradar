export interface Product {
  id: string;
  name: string;
  imageUrl: string;
  productSetId?: string;
  disabled?: boolean;
  currentBestPrice: number | null;
  currentBestShop: string | null;
  currentBestUrl: string | null;
}
