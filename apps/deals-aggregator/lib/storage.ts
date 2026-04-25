import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AffiliateConfig, Deal } from '@/types/deal';

const KEYS = {
  config: 'affiliate_config',
  customDeals: 'custom_deals',
  favorites: 'favorites',
  lastSeenDealId: 'last_seen_deal_id',
} as const;

export async function getAffiliateConfig(): Promise<AffiliateConfig> {
  const raw = await AsyncStorage.getItem(KEYS.config);
  return raw ? (JSON.parse(raw) as AffiliateConfig) : {};
}

export async function saveAffiliateConfig(config: AffiliateConfig): Promise<void> {
  await AsyncStorage.setItem(KEYS.config, JSON.stringify(config));
}

export async function getCustomDeals(): Promise<Deal[]> {
  const raw = await AsyncStorage.getItem(KEYS.customDeals);
  return raw ? (JSON.parse(raw) as Deal[]) : [];
}

export async function saveCustomDeals(deals: Deal[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.customDeals, JSON.stringify(deals));
}

export async function addCustomDeal(deal: Deal): Promise<Deal[]> {
  const current = await getCustomDeals();
  const updated = [deal, ...current];
  await saveCustomDeals(updated);
  return updated;
}

export async function removeCustomDeal(id: string): Promise<Deal[]> {
  const current = await getCustomDeals();
  const updated = current.filter((d) => d.id !== id);
  await saveCustomDeals(updated);
  return updated;
}

export async function getFavorites(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYS.favorites);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function toggleFavorite(id: string): Promise<string[]> {
  const current = await getFavorites();
  const updated = current.includes(id)
    ? current.filter((x) => x !== id)
    : [id, ...current];
  await AsyncStorage.setItem(KEYS.favorites, JSON.stringify(updated));
  return updated;
}

export async function getLastSeenDealId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.lastSeenDealId);
}

export async function setLastSeenDealId(id: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.lastSeenDealId, id);
}
