export interface Product {
  id: string;
  name: string;
  imageUrl: string;
  productSetId?: string;
  disabled?: boolean;
}

export interface ProductWithPrice extends Product {
  currentBestPrice: number | null;
  currentBestShop: string | null;
  currentBestUrl: string | null;
}
