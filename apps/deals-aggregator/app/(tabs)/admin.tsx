import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CATEGORY_LABELS,
  STORE_LABELS,
  type AffiliateConfig,
  type Category,
  type Deal,
  type Store,
} from '@/types/deal';
import {
  addCustomDeal,
  getAffiliateConfig,
  getCustomDeals,
  removeCustomDeal,
  saveAffiliateConfig,
} from '@/lib/storage';
import { notifyNewDeal } from '@/lib/notifications';
import { colors, radii, spacing } from '@/lib/theme';

const STORE_KEYS: Store[] = [
  'amazon',
  'mercadolivre',
  'shopee',
  'magalu',
  'aliexpress',
  'americanas',
  'outros',
];

const CATEGORY_KEYS: Category[] = [
  'eletronicos',
  'casa',
  'moda',
  'beleza',
  'esporte',
  'mercado',
  'outros',
];

const CONFIG_FIELDS: Array<{ key: keyof AffiliateConfig; label: string; hint: string }> = [
  { key: 'amazonTag', label: 'Amazon (tag)', hint: 'ex: meusite-20' },
  { key: 'mercadolivreId', label: 'Mercado Livre (ID)', hint: 'matt_word' },
  { key: 'shopeeId', label: 'Shopee (ID)', hint: 'use links já gerados' },
  { key: 'magaluId', label: 'Magalu (partner_id)', hint: 'ex: meusite' },
  { key: 'aliexpressId', label: 'AliExpress (ID)', hint: 'use links já gerados' },
  { key: 'americanasId', label: 'Americanas (opn)', hint: 'ex: XXAFFXX' },
];

export default function AdminScreen() {
  const [config, setConfig] = useState<AffiliateConfig>({});
  const [deals, setDeals] = useState<Deal[]>([]);

  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('');
  const [oldPrice, setOldPrice] = useState('');
  const [url, setUrl] = useState('');
  const [coupon, setCoupon] = useState('');
  const [store, setStore] = useState<Store>('amazon');
  const [category, setCategory] = useState<Category>('eletronicos');

  const load = useCallback(async () => {
    const [cfg, customs] = await Promise.all([getAffiliateConfig(), getCustomDeals()]);
    setConfig(cfg);
    setDeals(customs);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (key: keyof AffiliateConfig, val: string) => {
    setConfig((c) => ({ ...c, [key]: val }));
  };

  const onSaveConfig = async () => {
    await saveAffiliateConfig(config);
    Alert.alert('Pronto', 'IDs de afiliado salvos.');
  };

  const onAddDeal = async () => {
    if (!title.trim() || !url.trim() || !price.trim()) {
      Alert.alert('Faltam dados', 'Título, URL e preço são obrigatórios.');
      return;
    }
    const numericPrice = Number(price.replace(',', '.'));
    const numericOld = oldPrice ? Number(oldPrice.replace(',', '.')) : undefined;
    if (Number.isNaN(numericPrice)) {
      Alert.alert('Preço inválido', 'Use números (ex: 199.90).');
      return;
    }

    const deal: Deal = {
      id: `c_${Date.now()}`,
      title: title.trim(),
      store,
      category,
      imageUrl: imageUrl.trim() || 'https://via.placeholder.com/600x400?text=Oferta',
      price: numericPrice,
      oldPrice: numericOld,
      url: url.trim(),
      coupon: coupon.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const next = await addCustomDeal(deal);
    setDeals(next);
    await notifyNewDeal(deal);

    setTitle('');
    setImageUrl('');
    setPrice('');
    setOldPrice('');
    setUrl('');
    setCoupon('');

    Alert.alert('Cadastrada', 'Oferta publicada e notificação enviada.');
  };

  const onDelete = (id: string) => {
    Alert.alert('Remover oferta?', '', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          const next = await removeCustomDeal(id);
          setDeals(next);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.h1}>Painel Admin</Text>

          <Text style={styles.h2}>IDs de afiliado</Text>
          {CONFIG_FIELDS.map((f) => (
            <View key={f.key} style={styles.field}>
              <Text style={styles.label}>{f.label}</Text>
              <TextInput
                style={styles.input}
                value={config[f.key] ?? ''}
                onChangeText={(v) => updateField(f.key, v)}
                placeholder={f.hint}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ))}
          <Pressable style={styles.btn} onPress={onSaveConfig}>
            <Text style={styles.btnText}>Salvar IDs</Text>
          </Pressable>

          <Text style={[styles.h2, { marginTop: spacing.xl }]}>Cadastrar oferta</Text>

          <Field label="Título">
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Echo Dot 5"
              placeholderTextColor={colors.textMuted}
            />
          </Field>

          <Field label="URL do produto (afiliada se já gerada)">
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="https://..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />
          </Field>

          <Field label="URL da imagem">
            <TextInput
              style={styles.input}
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
          </Field>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Preço">
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="199.90"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </Field>
            </View>
            <View style={{ width: spacing.md }} />
            <View style={{ flex: 1 }}>
              <Field label="Preço antigo">
                <TextInput
                  style={styles.input}
                  value={oldPrice}
                  onChangeText={setOldPrice}
                  placeholder="349.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </Field>
            </View>
          </View>

          <Field label="Cupom (opcional)">
            <TextInput
              style={styles.input}
              value={coupon}
              onChangeText={setCoupon}
              placeholder="OFERTA20"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />
          </Field>

          <Text style={styles.label}>Loja</Text>
          <ChipsRow
            items={STORE_KEYS.map((k) => ({ key: k, label: STORE_LABELS[k] }))}
            value={store}
            onChange={(v) => setStore(v as Store)}
          />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Categoria</Text>
          <ChipsRow
            items={CATEGORY_KEYS.map((k) => ({ key: k, label: CATEGORY_LABELS[k] }))}
            value={category}
            onChange={(v) => setCategory(v as Category)}
          />

          <Pressable style={[styles.btn, { marginTop: spacing.lg }]} onPress={onAddDeal}>
            <Text style={styles.btnText}>Publicar oferta</Text>
          </Pressable>

          {deals.length > 0 && (
            <>
              <Text style={[styles.h2, { marginTop: spacing.xl }]}>
                Cadastradas ({deals.length})
              </Text>
              {deals.map((d) => (
                <View key={d.id} style={styles.dealRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dealTitle} numberOfLines={1}>
                      {d.title}
                    </Text>
                    <Text style={styles.dealMeta}>
                      {STORE_LABELS[d.store]} · R$ {d.price.toFixed(2)}
                    </Text>
                  </View>
                  <Pressable onPress={() => onDelete(d.id)} hitSlop={8}>
                    <Text style={styles.deleteBtn}>Remover</Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function ChipsRow({
  items,
  value,
  onChange,
}: {
  items: Array<{ key: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chipsWrap}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  h1: { color: colors.text, fontSize: 24, fontWeight: '900', marginBottom: spacing.lg },
  h2: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 4, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
  },
  row: { flexDirection: 'row' },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  dealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  dealTitle: { color: colors.text, fontWeight: '600' },
  dealMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  deleteBtn: { color: colors.danger, fontWeight: '700', fontSize: 13 },
});
