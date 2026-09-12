// Collection Screen — Fases 3 e 4
//
// Não é um tab: entra-se pela Home, como o histórico. Cinco tabs num telemóvel já é o limite, e a
// colecção consulta-se de vez em quando — não entre rondas de um torneio.
//
// Os preços são escritos pelo CI e lidos do bundle (ADR 0007). Este écran nunca lhes toca, e por
// isso não mostra nada que dependa de haver rede agora.

import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { useEventsStore } from '../store/useEventsStore';
import { byValueDesc, collectionValue, needsPrinting, priceIndex } from '../domain/collection';
import { isScryfallCard, type PickedCard } from '../domain/cards';
import { CardSearchModal } from '../components/CardSearchModal';
import type { CollectionCard } from '../types';

/** Euros com dois dígitos, à portuguesa. */
function euros(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

// ─── Evolução do valor ────────────────────────────────────────────────────────

/**
 * A evolução do valor, como uma linha de barras.
 *
 * Deliberadamente simples: com uma medição por semana, um gráfico a sério só faria sentido ao fim
 * de meses. Isto responde a "está a subir ou a descer" e mais nada.
 */
function ValueTrend({ entries }: { entries: { date: string; totalEur: number }[] }) {
  // Um ponto só não é uma tendência — é um ponto.
  if (entries.length < 2) return null;

  const recent = entries.slice(-12);
  const highest = Math.max(...recent.map(entry => entry.totalEur), 1);
  const first = recent[0].totalEur;
  const last = recent[recent.length - 1].totalEur;
  const change = last - first;

  return (
    <View style={trend.wrap}>
      <View style={trend.header}>
        <Text style={trend.label}>Value over time</Text>
        <Text style={[trend.change, { color: change >= 0 ? colors.win : colors.loss }]}>
          {change >= 0 ? '+' : '−'}{euros(Math.abs(change))}
        </Text>
      </View>

      <View style={trend.chart}>
        {recent.map(entry => (
          <View key={entry.date} style={trend.column}>
            <View
              style={[trend.bar, { height: `${Math.max((entry.totalEur / highest) * 100, 3)}%` }]}
            />
          </View>
        ))}
      </View>

      <View style={trend.axis}>
        <Text style={trend.axisText}>{recent[0].date}</Text>
        <Text style={trend.axisText}>{recent[recent.length - 1].date}</Text>
      </View>
    </View>
  );
}

// ─── Linha de carta ───────────────────────────────────────────────────────────

function CardRow({ card, stackEur, onChange, onLink }: {
  card: CollectionCard;
  stackEur: number | null;
  onChange: (quantity: number) => void;
  /** Abre a procura para apontar esta carta a uma impressão. Só existe nas escritas à mão. */
  onLink: () => void;
}) {
  const meta = [card.setCode?.toUpperCase(), card.condition, card.language?.toUpperCase()]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={row.container}>
      <View style={row.info}>
        <Text style={row.name} numberOfLines={1}>
          {card.name}
          {card.foil && <Text style={row.foil}> foil</Text>}
        </Text>
        {/*
          Sem impressão não há preço (ADR 0007), e dizê-lo sem dar saída seria só uma queixa. A
          linha passa a ser o botão que a resolve.
        */}
        {needsPrinting(card) ? (
          <Pressable onPress={onLink} hitSlop={8}>
            <Text style={row.link}>{meta ? `${meta} · ` : ''}set printing →</Text>
          </Pressable>
        ) : (
          <Text style={row.meta}>{meta || 'no printing details'}</Text>
        )}
      </View>

      <Text style={row.value}>{stackEur === null ? '—' : euros(stackEur)}</Text>

      {/* +/− em vez de teclado: mexer numa colecção grande com o polegar tem de ser suportável. */}
      <View style={row.stepper}>
        <Pressable
          onPress={() => onChange(card.quantity - 1)}
          hitSlop={8}
          style={({ pressed }) => [row.stepBtn, pressed && { opacity: 0.6 }]}
        >
          <Feather name="minus" size={14} color={colors.textSec} />
        </Pressable>
        <Text style={row.quantity}>{card.quantity}</Text>
        <Pressable
          onPress={() => onChange(card.quantity + 1)}
          hitSlop={8}
          style={({ pressed }) => [row.stepBtn, pressed && { opacity: 0.6 }]}
        >
          <Feather name="plus" size={14} color={colors.textSec} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function CollectionScreen() {
  const collection = useEventsStore(s => s.collection);
  const prices = useEventsStore(s => s.prices);
  const valueHistory = useEventsStore(s => s.valueHistory);
  const addToCollection = useEventsStore(s => s.addToCollection);
  const setCardQuantity = useEventsStore(s => s.setCardQuantity);
  const linkCollectionPrinting = useEventsStore(s => s.linkCollectionPrinting);

  const [query, setQuery] = useState('');

  // Um modal de procura só, para duas coisas: acrescentar uma carta nova e apontar uma que já cá
  // está a uma impressão. `linking` guarda qual — nulo quer dizer que é para acrescentar.
  const [searchOpen, setSearchOpen] = useState(false);
  const [linking, setLinking] = useState<CollectionCard | null>(null);

  const index = useMemo(() => priceIndex(prices), [prices]);
  const value = useMemo(() => collectionValue(collection, index), [collection, index]);

  const ranked = useMemo(() => {
    const all = byValueDesc(collection, index);
    const term = query.trim().toLowerCase();
    if (!term) return all;
    return all.filter(entry => entry.card.name.toLowerCase().includes(term));
  }, [collection, index, query]);

  function openSearch(card: CollectionCard | null) {
    setLinking(card);
    setSearchOpen(true);
  }

  /**
   * O que fazer com a carta escolhida na procura.
   *
   * A ligar, só uma impressão a sério serve: escolher outra vez só o nome deixava a carta na mesma
   * situação, sem preço possível. A acrescentar, o nome chega — é o caminho que funciona sem rede.
   */
  async function handlePick(picked: PickedCard) {
    setSearchOpen(false);
    const card = linking;
    setLinking(null);

    if (card) {
      if (isScryfallCard(picked)) await linkCollectionPrinting(card, picked);
      return;
    }

    await addToCollection({
      name: picked.name.trim(),
      quantity: 1,
      scryfallId: isScryfallCard(picked) ? picked.scryfallId : undefined,
      setCode: isScryfallCard(picked) ? picked.setCode : undefined,
      collectorNumber: isScryfallCard(picked) ? picked.collectorNumber : undefined,
    });
  }

  /** Acrescentar pelo nome, para não depender da rede nem da Scryfall. */
  async function addByName() {
    const name = query.trim();
    if (!name) return;
    await addToCollection({ name, quantity: 1 });
    setQuery('');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="chevron-left" size={24} color={colors.textSec} />
        </Pressable>
        <Text style={styles.navTitle}>Collection</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Valor */}
        <View style={styles.valueBlock}>
          <Text style={styles.total}>{euros(value.totalEur)}</Text>
          <Text style={styles.totalLabel}>
            {value.cards} card{value.cards === 1 ? '' : 's'}
            {value.priced < value.cards && ` · ${value.priced} priced`}
          </Text>

          {/* Nunca apresentar um total parcial como se fosse completo. */}
          {value.cards > 0 && value.priced < value.cards && (
            <Text style={styles.caveat}>
              {value.cards - value.priced} card{value.cards - value.priced === 1 ? '' : 's'} have no
              known price and are not counted above.
            </Text>
          )}

          <Text style={styles.source}>Reference prices from Scryfall, refreshed weekly.</Text>
        </View>

        <ValueTrend entries={valueHistory} />

        {/* Procurar / acrescentar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Feather name="search" size={15} color={colors.textDim} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Find or add a card"
              placeholderTextColor={colors.textDim}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Feather name="x" size={15} color={colors.textDim} />
              </Pressable>
            )}
          </View>

          {query.trim().length > 0 && (
            <Pressable
              onPress={addByName}
              style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.75 }]}
            >
              <Feather name="plus" size={16} color={colors.gold} />
            </Pressable>
          )}

          {/* A procura traz a impressão, e é a impressão que traz o preço. */}
          <Pressable
            onPress={() => openSearch(null)}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.75 }]}
          >
            <Feather name="search" size={16} color={colors.gold} />
          </Pressable>
        </View>

        {/* Lista */}
        {collection.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyText}>
              Type a name and tap + to add it, or search to pick the exact printing. Prices need
              the printing, and a card added by name alone can be pointed at one later.
            </Text>
          </View>
        ) : ranked.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No card matches “{query.trim()}”.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {ranked.map(entry => (
              <CardRow
                key={`${entry.card.scryfallId ?? entry.card.name}-${entry.card.foil ? 'f' : 'n'}`}
                card={entry.card}
                stackEur={entry.stackEur}
                onChange={quantity => void setCardQuantity(entry.card, quantity)}
                onLink={() => openSearch(entry.card)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <CardSearchModal
        visible={searchOpen}
        title={linking ? `Printing for ${linking.name}` : 'Add card'}
        onPick={card => void handlePick(card)}
        onClose={() => {
          setSearchOpen(false);
          setLinking(null);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navTitle: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.textPrim },
  content: { paddingBottom: 48 },

  valueBlock: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, gap: 4 },
  total: { fontFamily: fonts.display, fontSize: 38, color: colors.gold, lineHeight: 46 },
  totalLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  caveat: {
    fontFamily: fonts.bodyItal,
    fontSize: 12,
    color: colors.textSec,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  source: { fontFamily: fonts.bodyItal, fontSize: 11, color: colors.textDim, marginTop: 6 },

  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.textPrim },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold + '88',
    backgroundColor: colors.gold + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: { paddingHorizontal: 16 },
  empty: { paddingHorizontal: 32, paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.textSec },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 21,
  },
});

const row = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '66',
  },
  info: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bodyMed, fontSize: 15, color: colors.textPrim },
  foil: { fontFamily: fonts.bodyItal, fontSize: 12, color: colors.gold },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  link: { fontFamily: fonts.body, fontSize: 11, color: colors.gold },
  value: { fontFamily: fonts.displayMed, fontSize: 14, color: colors.textSec, minWidth: 56, textAlign: 'right' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    fontFamily: fonts.displayMed,
    fontSize: 15,
    color: colors.textPrim,
    minWidth: 22,
    textAlign: 'center',
  },
});

const trend = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginBottom: 24, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  change: { fontFamily: fonts.displayMed, fontSize: 14 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 64 },
  column: { flex: 1, justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', backgroundColor: colors.goldDim, borderRadius: 2, minHeight: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { fontFamily: fonts.body, fontSize: 10, color: colors.textDim },
});
