// Home Screen — MTG Recall
// Spec: design/handoff.md § 3

import { useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts, fontSize } from '../../theme/typography';
import { ManaPip } from '../../components/ManaPip';
import { TypeBadge } from '../../components/TypeBadge';
import { ManaColor, Event, calcEventStats, isActive } from '../../types';
import { formatDate } from '../../domain/dates';
import { eventThumbnailUrl } from '../../domain/thumbnails';
import { useEventsStore } from '../../store/useEventsStore';

// ─── Ornamento central (empty state) ─────────────────────────────────────────

const MANA_ORDER: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

function calcPentagonVertices(cx: number, cy: number, radius: number) {
  return MANA_ORDER.map((color, i) => {
    const angle = (-90 + i * 72) * (Math.PI / 180);
    return {
      color,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}

function ScholarOrnament({ size = 140 }: { size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const pipSize = Math.round(size * 0.20);
  const pipRadius = size * 0.365;
  const vertices = calcPentagonVertices(cx, cy, pipRadius);

  const lines: [number, number][] = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      lines.push([i, j]);
    }
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <Circle cx={cx} cy={cy} r={pipRadius + pipSize * 0.6} fill="none"
          stroke={colors.gold} strokeWidth={0.8} strokeOpacity={0.18} strokeDasharray="3,5" />
        <Circle cx={cx} cy={cy} r={pipRadius - pipSize * 0.7} fill="none"
          stroke={colors.goldDim} strokeWidth={0.6} strokeOpacity={0.25} />
        {lines.map(([i, j]) => (
          <Line key={`${i}-${j}`}
            x1={vertices[i].x} y1={vertices[i].y}
            x2={vertices[j].x} y2={vertices[j].y}
            stroke={colors.goldDim} strokeWidth={0.6} strokeOpacity={0.22} />
        ))}
        <Circle cx={cx} cy={cy} r={6} fill={colors.gold} fillOpacity={0.18}
          stroke={colors.gold} strokeWidth={1} strokeOpacity={0.45} />
        <Circle cx={cx} cy={cy} r={2.5} fill={colors.gold} fillOpacity={0.65} />
      </Svg>
      {vertices.map(v => (
        <View key={v.color} style={{ position: 'absolute', left: v.x - pipSize / 2, top: v.y - pipSize / 2 }}>
          <ManaPip color={v.color} size={pipSize} />
        </View>
      ))}
    </View>
  );
}

// ─── Secção: Evento Activo ────────────────────────────────────────────────────

/**
 * O evento a decorrer, em grande.
 *
 * **É o herói da Home de propósito.** Na esmagadora maioria dos dias há zero ou um torneio a
 * decorrer, nunca uma lista — e quando há um, é a única coisa que interessa: entrou-se na app entre
 * rondas, de pé, para registar um resultado. Um cartão da altura de uma linha, no meio de outros
 * elementos do mesmo tamanho, obrigava a procurar o que devia saltar à vista.
 *
 * Quando não há torneio nenhum isto não aparece, e o histórico — que estava por baixo — sobe
 * sozinho para o topo. Não é preciso decidir nada: o espaço vai para quem o ocupa.
 *
 * A altura é uma **fracção do ecrã** e não um número fixo: o que se quer é "metade da página", e
 * isso significa coisas diferentes num telemóvel pequeno e num grande. Os limites existem para não
 * cair em nenhum dos dois extremos ridículos.
 */
function ActiveEventSection({ event }: { event: Event }) {
  const decks = useEventsStore(s => s.decks);
  const { height } = useWindowDimensions();

  const round = event.matches.length + 1;
  const stats = calcEventStats(event);
  const played = stats.wins + stats.losses + stats.draws;
  const art = eventThumbnailUrl(event, decks);
  const deckColors = event.deckColors;

  const cardHeight = Math.round(Math.min(Math.max(height * 0.52, 340), 520));

  function goToMatch() {
    router.push({
      pathname: '/match-registration',
      params: { eventId: event.id, round: String(round), eventName: event.name },
    });
  }

  return (
    <View>
      {/* Label com accent bar */}
      <View style={active.labelRow}>
        <LinearGradient
          colors={[colors.gold, colors.goldDim]}
          style={active.accentBar}
        />
        <Text style={active.label}>Active Event</Text>
      </View>

      <Pressable
        onPress={() => router.push(`/event/${event.id}`)}
        style={({ pressed }) => [active.card, { height: cardHeight }, pressed && { opacity: 0.88 }]}
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
          // Um evento sem deck ligado não tem arte. Fica a superfície da app com o emblema, que se
          // reconhece como "ainda sem deck" e não como uma imagem que falhou a carregar.
          <View style={active.noArt}>
            <Feather name="award" size={34} color={colors.goldDim} />
          </View>
        )}

        {/*
          Dois véus e não um: o de cima para os badges se lerem sobre uma arte clara, o de baixo
          para o nome e o resultado. O meio fica limpo — é onde a arte se vê.
        */}
        <LinearGradient
          colors={['rgba(10,8,5,0.62)', 'transparent', 'rgba(10,8,5,0.70)', 'rgba(10,8,5,0.97)']}
          locations={[0, 0.28, 0.6, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={active.top}>
          <View style={active.liveBadge}>
            <View style={active.liveDot} />
            <Text style={active.liveText}>Live</Text>
          </View>
          <TypeBadge type={event.type} />
        </View>

        <View style={active.bottom}>
          <Text style={active.name} numberOfLines={2}>{event.name}</Text>

          <View style={active.meta}>
            {deckColors && (
              <>
                {deckColors.main.map(c => <ManaPip key={`m-${c}`} color={c} size={14} />)}
                {deckColors.splash.map(c => <ManaPip key={`s-${c}`} color={c} size={14} isSplash />)}
                <Text style={active.metaDot}>·</Text>
              </>
            )}
            <Feather name="calendar" size={11} color={colors.textDim} />
            <Text style={active.metaText}>{formatDate(event.date)}</Text>
          </View>

          {/*
            O resultado em grande. É o número que se quer saber ao pegar no telemóvel entre rondas,
            e a Home é onde se pega — não vale a pena obrigar a abrir o evento para o ver.
          */}
          <View style={active.scoreRow}>
            <View style={active.score}>
              <Text style={[active.scoreValue, { color: colors.win }]}>{stats.wins}</Text>
              <Text style={active.scoreSep}>–</Text>
              <Text style={[active.scoreValue, { color: colors.loss }]}>{stats.losses}</Text>
              {stats.draws > 0 && (
                <>
                  <Text style={active.scoreSep}>–</Text>
                  <Text style={[active.scoreValue, { color: colors.draw }]}>{stats.draws}</Text>
                </>
              )}
            </View>

            <View style={active.scoreDivider} />

            <View style={active.scoreCell}>
              {/* Zero rondas jogadas não é 0% — é ainda nada. Um 0% aqui lia-se como derrota. */}
              <Text style={active.scoreSmall}>{played > 0 ? `${stats.winRate}%` : '—'}</Text>
              <Text style={active.scoreLabel}>win rate</Text>
            </View>

            <View style={active.scoreDivider} />

            <View style={active.scoreCell}>
              <Text style={active.scoreSmall}>{stats.points}</Text>
              <Text style={active.scoreLabel}>points</Text>
            </View>
          </View>

          {/*
            A acção vive **dentro** do cartão. Era uma linha à parte por baixo, do tamanho de tudo o
            resto; aqui está onde já se está a olhar, e o cartão passa a valer sozinho.
          */}
          <Pressable
            onPress={goToMatch}
            style={({ pressed }) => [active.action, pressed && { opacity: 0.85 }]}
          >
            <Text style={active.actionPlus}>+</Text>
            <Text style={active.actionText}>Register round {round}</Text>
            <Feather
              name="chevron-right"
              size={16}
              color={colors.bg}
              style={{ marginLeft: 'auto' }}
            />
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

const active = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  accentBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  label: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gold + '55',
    overflow: 'hidden',
    backgroundColor: colors.bgCard,
    justifyContent: 'space-between',
  },
  noArt: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.gold + '26',
    borderWidth: 1,
    borderColor: colors.gold + '77',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  liveText: {
    fontFamily: fonts.displaySemi,
    fontSize: 11,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bottom: {
    padding: 16,
    gap: 10,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 32,
    color: colors.textPrim,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaDot: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
    marginHorizontal: 2,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSec,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 2,
  },
  score: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  scoreValue: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
  },
  scoreSep: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.textDim,
  },
  scoreDivider: {
    width: 1,
    height: 26,
    backgroundColor: colors.border,
  },
  scoreCell: {
    alignItems: 'flex-start',
  },
  scoreSmall: {
    fontFamily: fonts.displaySemi,
    fontSize: 17,
    color: colors.textPrim,
  },
  scoreLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSec,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.gold,
  },
  actionPlus: {
    fontFamily: fonts.displaySemi,
    fontSize: 18,
    lineHeight: 20,
    color: colors.bg,
    includeFontPadding: false,
  },
  actionText: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.bg,
  },
});

// ─── Stats Block ─────────────────────────────────────────────────────────────

function StatsBlock({ eventCount, winRate }: { eventCount: number; winRate: number }) {
  return (
    <View style={statsBlock.container}>
      <View style={statsBlock.cell}>
        <Text style={statsBlock.value}>{eventCount}</Text>
        <Text style={statsBlock.label}>Events</Text>
      </View>
      <View style={statsBlock.divider} />
      <View style={statsBlock.cell}>
        <Text style={statsBlock.value}>{winRate}%</Text>
        <Text style={statsBlock.label}>Win Rate</Text>
      </View>
      <View style={statsBlock.divider} />
      <View style={statsBlock.cell}>
        <Text style={[statsBlock.value, statsBlock.valueDim]}>—</Text>
        <Text style={statsBlock.label}>Portfolio</Text>
      </View>
    </View>
  );
}

const statsBlock = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.textPrim,
  },
  valueDim: {
    color: colors.textDim,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSec,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
});

// ─── History Entry Point ──────────────────────────────────────────────────────

function HistoryEntryPoint() {
  return (
    <View style={history.row}>
      <Text style={history.label}>Tournament History</Text>
      <Pressable onPress={() => router.push('/(tabs)/events')} hitSlop={8}>
        <Text style={history.seeAll}>See all →</Text>
      </Pressable>
    </View>
  );
}

/**
 * Entrada para a colecção.
 *
 * Aqui e não num tab: cinco tabs num telemóvel já é o limite, e a colecção consulta-se de vez em
 * quando — não entre rondas de um torneio, que é para o que a tab bar existe.
 */
function CollectionEntryPoint() {
  const collection = useEventsStore(s => s.collection);
  const total = collection.reduce((sum, card) => sum + card.quantity, 0);

  return (
    <Pressable
      style={({ pressed }) => [history.row, pressed && { opacity: 0.7 }]}
      onPress={() => router.push('/collection')}
    >
      <Text style={history.label}>Collection</Text>
      <Text style={history.seeAll}>
        {total > 0 ? `${total} cards →` : 'Set up →'}
      </Text>
    </Pressable>
  );
}

const history = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  label: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  seeAll: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
  },
});

// ─── Home Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const events     = useEventsStore(s => s.events);
  const isLoading  = useEventsStore(s => s.isLoading);
  const load       = useEventsStore(s => s.load);

  useEffect(() => {
    if (events.length === 0 && !isLoading) {
      load();
    }
  }, []);

  const hasEvents   = events.length > 0;
  const activeEvent = events.find(isActive);

  const totalMatches = events.reduce((s, e) => s + e.matches.length, 0);
  const totalWins    = events.reduce((s, e) => s + e.matches.filter(m => m.result === 'W').length, 0);
  const overallWR    = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.archiveLabel}>Scholar's Archive</Text>
          <Text style={styles.headerTitle}>Home</Text>
        </View>
        {hasEvents && (
          <Pressable style={styles.newEventBtn} onPress={() => router.push('/add-event')}>
            <Text style={styles.newEventBtnText}>+ New Event</Text>
          </Pressable>
        )}
      </View>

      {/* Empty State */}
      {!hasEvents && (
        <View style={styles.emptyState}>
          <ScholarOrnament size={148} />
          <Text style={styles.emptyTitle}>Welcome to Scholar's Archive</Text>
          <Text style={styles.emptySubtitle}>
            Register your first tournament and start building your archive of victories.
          </Text>
          <View style={styles.flavourCard}>
            <Text style={styles.flavourQuote}>
              "Knowledge is the greatest spell ever cast."
            </Text>
            <Text style={styles.flavourSource}>— Scholar's Archive</Text>
          </View>
          <Pressable
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push('/add-event')}
          >
            <LinearGradient
              colors={[colors.gold, '#A07840']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>+ Register first event</Text>
            </LinearGradient>
          </Pressable>

          {/*
            A colecção também se chega por aqui, e não só depois do primeiro evento.
            Quem instala a app antes do torneio seguinte quer montar a colecção primeiro — e sem
            este atalho não tinha por onde lá chegar, porque a colecção não é um tab.
          */}
          <Pressable
            onPress={() => router.push('/collection')}
            hitSlop={10}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={styles.emptySecondary}>or start with your collection →</Text>
          </Pressable>
        </View>
      )}

      {/* Variante "com dados" */}
      {hasEvents && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}>
          {/*
            A ordem depende de haver torneio a decorrer, e é a única coisa nesta Home que muda.

            Com torneio, ele vem primeiro: entrou-se na app entre rondas e é isso que se quer ver.
            O total de eventos e o win rate de sempre continuam a ler-se igual de bem logo abaixo —
            são números de referência, não são o que trouxe ninguém aqui a meio de um sábado.

            Sem torneio, o bloco de números sobe para o topo e o histórico vem a seguir, que é o que
            resta para ver.
          */}
          {activeEvent && <ActiveEventSection event={activeEvent} />}
          <StatsBlock eventCount={events.length} winRate={overallWR} />
          <HistoryEntryPoint />
          <CollectionEntryPoint />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  emptySecondary: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSec,
    textAlign: 'center',
    marginTop: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  archiveLabel: {
    fontFamily: fonts.displayItal,
    fontSize: 11,
    color: colors.goldDim,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.h1,
    color: colors.textPrim,
    lineHeight: 34,
  },
  newEventBtn: {
    backgroundColor: colors.gold,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 4,
  },
  newEventBtnText: {
    fontFamily: fonts.displaySemi,
    fontSize: 13,
    color: colors.bg,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 24,
    gap: 20,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    color: colors.textPrim,
    textAlign: 'center',
    lineHeight: 30,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: colors.textSec,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: -4,
  },
  flavourCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  flavourQuote: {
    fontFamily: fonts.bodyItal,
    fontSize: 13,
    color: colors.textSec,
    textAlign: 'center',
    lineHeight: 20,
  },
  flavourSource: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  ctaButton: {
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    minWidth: 240,
  },
  ctaText: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.bg,
    letterSpacing: 0.3,
  },
});
