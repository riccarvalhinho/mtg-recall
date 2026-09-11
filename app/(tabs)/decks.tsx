// Decks Screen — a lista de decks
//
// O écran existe para responder à pergunta que justifica a Fase 2 inteira (docs/product/roadmap.md):
// com que deck é que se ganha mais. Por isso a ordem da lista não é alfabética — é a do
// `rankDecks`, do melhor desempenho para o pior, com os decks ainda não jogados no fim.
//
// As contas estão todas em `domain/deck.ts`. Aqui só se desenha.

import { useEffect, useMemo } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { fonts, fontSize } from '../../theme/typography';
import { Deck } from '../../types';
import { DeckPerformance, cardCount, rankDecks } from '../../domain/deck';
import { useEventsStore } from '../../store/useEventsStore';
import { ManaPip } from '../../components/ManaPip';
import { RecordBadge } from '../../components/RecordBadge';
import { TypeBadge } from '../../components/TypeBadge';

// ─── Card de deck ─────────────────────────────────────────────────────────────

function DeckRow({ deck, performance, onPress }: {
  deck: Deck;
  performance: DeckPerformance;
  onPress: () => void;
}) {
  const played = performance.wins + performance.losses + performance.draws;
  const cards = cardCount(deck.cards);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardRow}>
        <View style={styles.info}>
          {/* Formato e arquétipo — ambos opcionais, a linha desaparece se não houver nenhum */}
          {(deck.format || deck.archetype) && (
            <View style={styles.badges}>
              {deck.format && <TypeBadge type={deck.format} />}
              {deck.archetype && (
                <Text style={styles.archetype} numberOfLines={1}>{deck.archetype}</Text>
              )}
            </View>
          )}

          <Text style={styles.name} numberOfLines={1}>{deck.name}</Text>

          <View style={styles.meta}>
            {deck.colors.main.map(c => (
              <ManaPip key={`main-${c}`} color={c} size={14} />
            ))}
            {deck.colors.splash.map(c => (
              <ManaPip key={`splash-${c}`} color={c} size={14} isSplash />
            ))}
            {(deck.colors.main.length > 0 || deck.colors.splash.length > 0) && (
              <Text style={styles.metaDot}>·</Text>
            )}
            {/* Um deck sem lista não é um erro: serve na mesma para saber com que deck se ganha */}
            <Text style={styles.metaText}>
              {cards > 0 ? `${cards} cards` : 'no list yet'}
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>
              {performance.events === 1 ? '1 event' : `${performance.events} events`}
            </Text>
          </View>
        </View>

        {/* Desempenho. Um deck por jogar mostra-o por palavras — um 0–0 a 0% parecia uma derrota */}
        <View style={styles.right}>
          {played > 0 ? (
            <RecordBadge
              wins={performance.wins}
              losses={performance.losses}
              draws={performance.draws}
            />
          ) : (
            <Text style={styles.unplayed}>unplayed</Text>
          )}
          <Feather name="chevron-right" size={14} color={colors.textDim} style={styles.chevron} />
        </View>
      </View>
    </Pressable>
  );
}

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
          data={ranked}
          keyExtractor={item => item.deck.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.sectionLabel}>
              {decks.length === 1 ? '1 deck · best first' : `${decks.length} decks · best first`}
            </Text>
          }
          renderItem={({ item }) => (
            <DeckRow
              deck={item.deck}
              performance={item.performance}
              onPress={() => router.push({
                pathname: '/deck/[id]',
                params: { id: item.deck.id },
              })}
            />
          )}
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
  sectionLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: 16,
    marginBottom: 10,
  },

  // Card
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  cardPressed: {
    backgroundColor: colors.bgCardHov,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // Alvo de toque muito acima dos 44px: usa-se de pé, numa loja, com uma mão
    minHeight: 72,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  archetype: {
    flex: 1,
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textSec,
  },
  name: {
    fontFamily: fonts.displayMed,
    fontSize: 15,
    color: colors.textPrim,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textDim,
  },
  metaDot: {
    color: colors.textDim,
    fontSize: 10,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unplayed: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
  },
  chevron: {
    opacity: 0.4,
  },
});
