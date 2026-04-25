import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DealCard } from '@/components/DealCard';
import { StoreFilter } from '@/components/StoreFilter';
import { buildAffiliateUrl } from '@/lib/affiliate';
import { loadAllDeals } from '@/lib/deals';
import { notifyNewDeals } from '@/lib/notifications';
import {
  getAffiliateConfig,
  getFavorites,
  getLastSeenDealId,
  setLastSeenDealId,
  toggleFavorite,
} from '@/lib/storage';
import { colors, spacing } from '@/lib/theme';
import type { AffiliateConfig, Deal, Store } from '@/types/deal';

export default function FeedScreen() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [config, setConfig] = useState<AffiliateConfig>({});
  const [filter, setFilter] = useState<Store | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (notifyNew = false) => {
    const [allDeals, favs, cfg, lastSeen] = await Promise.all([
      loadAllDeals(),
      getFavorites(),
      getAffiliateConfig(),
      getLastSeenDealId(),
    ]);
    setDeals(allDeals);
    setFavorites(favs);
    setConfig(cfg);

    if (notifyNew && lastSeen && allDeals.length > 0) {
      const newOnes: Deal[] = [];
      for (const d of allDeals) {
        if (d.id === lastSeen) break;
        newOnes.push(d);
      }
      if (newOnes.length > 0) {
        await notifyNewDeals(newOnes);
      }
    }
    if (allDeals[0]) {
      await setLastSeenDealId(allDeals[0].id);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh(true);
    setRefreshing(false);
  }, [refresh]);

  const filtered = useMemo(() => {
    if (filter === 'all') return deals;
    return deals.filter((d) => d.store === filter);
  }, [deals, filter]);

  const onOpenDeal = useCallback(
    async (deal: Deal) => {
      const url = buildAffiliateUrl(deal, config);
      await WebBrowser.openBrowserAsync(url);
    },
    [config],
  );

  const onToggleFav = useCallback(async (id: string) => {
    const next = await toggleFavorite(id);
    setFavorites(next);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.brand}>Ofertas Hub 🔥</Text>
        <Text style={styles.sub}>{filtered.length} ofertas ativas</Text>
      </View>

      <StoreFilter value={filter} onChange={setFilter} />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <DealCard
            deal={item}
            isFavorite={favorites.includes(item.id)}
            onPress={() => onOpenDeal(item)}
            onToggleFavorite={() => onToggleFav(item.id)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhuma oferta nesta loja ainda.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  brand: { color: colors.text, fontSize: 24, fontWeight: '900' },
  sub: { color: colors.textMuted, marginTop: 2 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },
});
