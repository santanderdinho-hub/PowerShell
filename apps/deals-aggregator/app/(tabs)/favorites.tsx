import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DealCard } from '@/components/DealCard';
import { buildAffiliateUrl } from '@/lib/affiliate';
import { loadAllDeals } from '@/lib/deals';
import { getAffiliateConfig, getFavorites, toggleFavorite } from '@/lib/storage';
import { colors, spacing } from '@/lib/theme';
import type { AffiliateConfig, Deal } from '@/types/deal';

export default function FavoritesScreen() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [config, setConfig] = useState<AffiliateConfig>({});

  const load = useCallback(async () => {
    const [allDeals, favs, cfg] = await Promise.all([
      loadAllDeals(),
      getFavorites(),
      getAffiliateConfig(),
    ]);
    setDeals(allDeals);
    setFavorites(favs);
    setConfig(cfg);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = deals.filter((d) => favorites.includes(d.id));

  const onOpen = async (deal: Deal) => {
    await WebBrowser.openBrowserAsync(buildAffiliateUrl(deal, config));
  };

  const onToggleFav = async (id: string) => {
    const next = await toggleFavorite(id);
    setFavorites(next);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Seus favoritos</Text>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <DealCard
            deal={item}
            isFavorite
            onPress={() => onOpen(item)}
            onToggleFavorite={() => onToggleFav(item.id)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Toque no ♡ em uma oferta para salvá-la aqui.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },
});
