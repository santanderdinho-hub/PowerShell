import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Deal } from '@/types/deal';
import { STORE_LABELS } from '@/types/deal';
import { discountPercent, formatPrice } from '@/lib/deals';
import { colors, radii, spacing } from '@/lib/theme';

interface Props {
  deal: Deal;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}

export function DealCard({ deal, isFavorite, onPress, onToggleFavorite }: Props) {
  const discount = discountPercent(deal.price, deal.oldPrice);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: deal.imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={150}
        />
        {discount !== null && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        )}
        <Pressable
          hitSlop={12}
          onPress={onToggleFavorite}
          style={styles.favBtn}
        >
          <Text style={styles.favIcon}>{isFavorite ? '♥' : '♡'}</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.store}>{STORE_LABELS[deal.store]}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {deal.title}
        </Text>

        <View style={styles.priceRow}>
          {deal.oldPrice && (
            <Text style={styles.oldPrice}>{formatPrice(deal.oldPrice)}</Text>
          )}
          <Text style={styles.price}>{formatPrice(deal.price)}</Text>
        </View>

        {deal.coupon && (
          <View style={styles.couponBox}>
            <Text style={styles.couponLabel}>CUPOM</Text>
            <Text style={styles.couponCode}>{deal.coupon}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  pressed: { opacity: 0.85 },
  imageWrap: {
    position: 'relative',
    backgroundColor: colors.surfaceAlt,
    aspectRatio: 16 / 10,
  },
  image: { width: '100%', height: '100%' },
  discountBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  discountText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  favBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favIcon: { color: colors.accent, fontSize: 22, lineHeight: 24 },
  body: { padding: spacing.md, gap: 6 },
  store: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: 4,
  },
  oldPrice: {
    color: colors.textMuted,
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  price: { color: colors.accent, fontSize: 20, fontWeight: '800' },
  couponBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
  },
  couponLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  couponCode: { color: colors.text, fontSize: 12, fontWeight: '700' },
});
