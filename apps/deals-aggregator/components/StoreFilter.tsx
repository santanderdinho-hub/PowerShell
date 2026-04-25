import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { STORE_LABELS, type Store } from '@/types/deal';
import { colors, radii, spacing } from '@/lib/theme';

interface Props {
  value: Store | 'all';
  onChange: (next: Store | 'all') => void;
}

const ORDER: Array<Store | 'all'> = [
  'all',
  'amazon',
  'mercadolivre',
  'shopee',
  'magalu',
  'aliexpress',
  'americanas',
  'outros',
];

export function StoreFilter({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {ORDER.map((key) => {
        const active = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {key === 'all' ? 'Todas' : STORE_LABELS[key]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  labelActive: { color: '#fff' },
});
