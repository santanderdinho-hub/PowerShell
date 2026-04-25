export type Store =
  | 'amazon'
  | 'mercadolivre'
  | 'shopee'
  | 'magalu'
  | 'aliexpress'
  | 'americanas'
  | 'outros';

export type Category =
  | 'eletronicos'
  | 'casa'
  | 'moda'
  | 'beleza'
  | 'esporte'
  | 'mercado'
  | 'outros';

export interface Deal {
  id: string;
  title: string;
  store: Store;
  category: Category;
  imageUrl: string;
  price: number;
  oldPrice?: number;
  url: string;
  productId?: string;
  coupon?: string;
  createdAt: string;
  featured?: boolean;
}

export interface AffiliateConfig {
  amazonTag?: string;
  mercadolivreId?: string;
  shopeeId?: string;
  magaluId?: string;
  aliexpressId?: string;
  americanasId?: string;
}

export const STORE_LABELS: Record<Store, string> = {
  amazon: 'Amazon',
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  magalu: 'Magalu',
  aliexpress: 'AliExpress',
  americanas: 'Americanas',
  outros: 'Outros',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  eletronicos: 'Eletrônicos',
  casa: 'Casa',
  moda: 'Moda',
  beleza: 'Beleza',
  esporte: 'Esporte',
  mercado: 'Mercado',
  outros: 'Outros',
};
