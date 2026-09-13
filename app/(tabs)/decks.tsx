// Decks Screen — a lista de decks
//
// O écran existe para responder à pergunta que justifica a Fase 2 inteira (docs/product/roadmap.md):
// com que deck é que se ganha mais. Por isso a ordem da lista não é alfabética — é a do
// `rankDecks`, do melhor desempenho para o pior, com os decks ainda não jogados no fim.
//
// **Grelha de dois e não lista de linhas.** Um deck reconhece-se pela arte antes de se lhe ler o
// nome, e numa linha de 50 px de altura a arte não chega para isso. O quadrado dá-lhe espaço; o
// nome e o registo vão por cima, sobre um véu, porque texto claro sobre uma arte clara não se lê.
//
// As contas estão todas em `domain/deck.ts`. Aqui só se desenha.

import { useEffect, useMemo } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { colors } from '../../theme/colors';
import { fonts, fontSize } from '../../theme/typography';
import { Deck } from '../../types';
import { DeckPerformance, cardCount, rankDecks, splitByPurpose } from '../../domain/deck';
import { useEventsStore } from '../../store/useEventsStore';
import { ManaPip } from '../../components/ManaPip';
import { RecordBadge } from '../../components/RecordBadge';
import { TypeBadge } from '../../components/TypeBadge';
import { deckThumbnailUrl } from '../../domain/thumbnails';

// ─── Card de deck ─────────────────────────────────────────────────────────────

function DeckTile({ deck, performance, onPress }: {
  deck: Deck;
  performance: DeckPerformance;
  onPress: () => void;
}) {
  const played = performance.wins + performance.losses + performance.draws;
  const cards = cardCount(deck.cards);
  const art = deckThumbnailUrl(deck);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [tile.container, pressed && { opacity: 0.75 }]}
    >
      {art ? (
        <Image
          source={{ uri: art }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={140}
          cachePolicy="memory-disk"
        />
      ) : (
        // Um deck sem lista, ou escrito à mão, não tem arte nenhuma. Em vez de um buraco preto
        // fica a superfície da app com o emblema — reconhece-se como "deck sem cartas", que é o
        // que é, e não como uma imagem que falhou.
        <View style={tile.noArt}>
          <Feather name="layers" size={26} color={colors.goldDim} />
        </View>
      )}

      {/* O véu existe para o nome se ler: uma arte clara por baixo de texto claro não se lê. */}
      <LinearGradient
        colors={['transparent', 'rgba(10,8,5,0.55)', 'rgba(10,8,5,0.95)']}
        locations={[0.32, 0.62, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={tile.top}>
        {deck.format ? <TypeBadge type={deck.format} /> : <View />}
        {played > 0 ? (
          <RecordBadge
            wins={performance.wins}
            losses={performance.losses}
            draws={performance.draws}
          />
        ) : (
          <Text style={tile.unplayed}>unplayed</Text>
        )}
      </View>

      <View style={tile.bottom}>
        <Text style={tile.name} numberOfLines={2}>{deck.name}</Text>

        <View style={tile.meta}>
          {deck.colors.main.map(c => <ManaPip key={`main-${c}`} color={c} size={13} />)}
          {deck.colors.splash.map(c => <ManaPip key={`splash-${c}`} color={c} size={13} isSplash />)}
          <Text style={tile.metaText} numberOfLines={1}>
            {cards > 0 ? `${cards} cards` : 'no list yet'} · {performance.events === 1 ? '1 event' : `${performance.events} events`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const tile = StyleSheet.create({
  container: {
    flex: 1,
    // Quadrado, como na referência. O `art_crop` é deitado e fica cortado dos lados — a arte da
    // Scryfall é centrada no que interessa, portanto o corte não come o assunto.
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    justifyContent: 'space-between',
    padding: 10,
  },
  noArt: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 },
  bottom: { gap: 6 },
  name: { fontFamily: fonts.displaySemi, fontSize: 15, lineHeight: 19, color: '#F3EADA' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  metaText: { fontFamily: fonts.body, fontSize: 11, color: '#BCAE97' },
  unplayed: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: '#D6C9B2',
    backgroundColor: 'rgba(10,8,5,0.55)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={empty.container}>
      <View style={empty.emblem}>
        <Feather name="layers" size={30} color={colors.goldDim} />
      </View>
      <Text style={empty.title}>No decks yet</Text>
      <Text style={empty.subtitle}>
        Register the decks you play and every tournament will tell you which one wins the most.
      </Text>
      <Pressable
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        onPress={() => router.push('/deck-editor')}
      >
        <LinearGradient
          colors={[colors.gold, '#A07840']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={empty.cta}
        >
          <Text style={empty.ctaText}>+ Add first deck</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const empty = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
    gap: 18,
  },
  emblem: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    color: colors.textPrim,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: colors.textSec,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: -6,
  },
  cta: {
    borderRadius: 22,
    paddingHorizontal: 22,
    height: 46,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.bg,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

/** Um deck com o seu desempenho, que é o que o tile precisa. */
type DeckEntry = { deck: Deck; performance: DeckPerformance };

/**
 * Uma linha da lista: um cabeçalho de secção, ou **um par** de decks.
 *
 * O par existe porque a grelha e os cabeçalhos não se dão bem no mesmo `FlatList`: com
 * `numColumns` os cabeçalhos passariam a ocupar meia largura. Emparelhar à mão mantém uma lista só,
 * com as secções pelo meio, e um par ímpar no fim fica com metade vazia em vez de um tile esticado.
 */
type DeckRowItem =
  | { kind: 'header'; label: string }
  | { kind: 'pair'; left: DeckEntry; right?: DeckEntry };

/** Parte uma lista em pares, pela ordem que vem. */
function inPairs(entries: DeckEntry[]): DeckRowItem[] {
  const rows: DeckRowItem[] = [];
  for (let i = 0; i < entries.length; i += 2) {
    rows.push({ kind: 'pair', left: entries[i], right: entries[i + 1] });
  }
  return rows;
}

export default function DecksScreen() {
  const decks  = useEventsStore(s => s.decks);
  const events = useEventsStore(s => s.events);
  const load   = useEventsStore(s => s.load);

  // Como nos outros écrans: relê a cópia local ao montar, que é instantâneo e não precisa de rede
  useEffect(() => {
    load();
  }, []);

  // `rankDecks` devolve desempenhos, não decks — a lista junta cada um ao seu deck pela ordem dele
  const ranked = useMemo(() => {
    const byId = new Map(decks.map(deck => [deck.id, deck]));
    return rankDecks(decks, events)
      .map(performance => ({ performance, deck: byId.get(performance.deckId) }))
      .filter((entry): entry is { performance: DeckPerformance; deck: Deck } =>
        entry.deck !== undefined,
      );
  }, [decks, events]);

  /**
   * A lista, em duas secções.
   *
   * Os decks de Sealed e Draft existiram para um torneio só e nunca mais se jogam — continuam a
   * valer pelo registo, mas ao fim de um ano de Limited mensal soterravam os decks a sério. Ficam
   * em baixo, com o título a dizer porquê. Sem secção vazia: quem nunca jogou Limited não vê
   * cabeçalho nenhum.
   */
  const rows = useMemo((): DeckRowItem[] => {
    const { kept, oneOff } = splitByPurpose(ranked);
    const list: DeckRowItem[] = [];

    if (kept.length > 0) {
      list.push({ kind: 'header', label: `${kept.length} ${kept.length === 1 ? 'deck' : 'decks'} · best first` });
      list.push(...inPairs(kept));
    }

    if (oneOff.length > 0) {
      list.push({ kind: 'header', label: `Limited · ${oneOff.length} built for one event` });
      list.push(...inPairs(oneOff));
    }

    return list;
  }, [ranked]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.archiveLabel}>Personal Archive</Text>
          <Text style={styles.title}>Decks</Text>
        </View>
        {decks.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/deck-editor')}
          >
            <Text style={styles.newBtnText}>+ New Deck</Text>
          </Pressable>
        )}
      </View>

      {decks.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={row => (row.kind === 'header' ? `h-${row.label}` : row.left.deck.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item: row }) =>
            row.kind === 'header' ? (
              <Text style={styles.sectionLabel}>{row.label}</Text>
            ) : (
              <View style={styles.pair}>
                <DeckTile
                  deck={row.left.deck}
                  performance={row.left.performance}
                  onPress={() => router.push({ pathname: '/deck/[id]', params: { id: row.left.deck.id } })}
                />
                {row.right ? (
                  <DeckTile
                    deck={row.right.deck}
                    performance={row.right.performance}
                    onPress={() => router.push({ pathname: '/deck/[id]', params: { id: row.right!.deck.id } })}
                  />
                ) : (
                  // Metade vazia em vez de um tile esticado: um deck sozinho na linha não deve
                  // ficar do dobro do tamanho dos outros só por ser o último.
                  <View style={{ flex: 1 }} />
                )}
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  archiveLabel: {
    fontFamily: fonts.displayItal,
    fontSize: 11,
    color: colors.goldDim,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h1,
    color: colors.textPrim,
    lineHeight: 34,
  },
  newBtn: {
    backgroundColor: colors.gold,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 4,
  },
  newBtnText: {
    fontFamily: fonts.displaySemi,
    fontSize: 13,
    color: colors.bg,
  },

  list: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  /** Uma linha da grelha. O espaço entre tiles é o mesmo dos lados, para a grelha parecer grelha. */
  pair: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 6,
  },

  // Card
});
