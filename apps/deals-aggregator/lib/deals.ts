import seedDeals from '@/data/deals.json';
import type { Deal } from '@/types/deal';
import { getCustomDeals } from './storage';

export async function loadAllDeals(): Promise<Deal[]> {
  const custom = await getCustomDeals();
  const seed = seedDeals as Deal[];
  const merged = [...custom, ...seed];

  return merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function discountPercent(price: number, oldPrice?: number): number | null {
  if (!oldPrice || oldPrice <= price) return null;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}
