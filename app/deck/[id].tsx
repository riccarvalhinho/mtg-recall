// Deck Detail Screen — Fase 2 (lista com arte e subtipos: Fase 5)
//
// O que um deck responde: com que frequência ganha, em que torneios foi jogado, e de que é feito.
// Os gráficos são desenhados com Views em vez de uma biblioteca — a app tem de abrir sem rede e sem
// surpresas de bundle, e quatro gráficos de barras não justificam uma dependência.
//
// As contas estão todas em `domain/deck.ts` e têm testes. Aqui só se desenha.

import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { useEventsStore } from '../../store/useEventsStore';
import { ManaPip } from '../../components/ManaPip';
import { TypeBadge } from '../../components/TypeBadge';
import { CardArtThumb, artHeightFor } from '../../components/CardArtThumb';
import { CardImageOverlay } from '../../components/CardImageOverlay';
import { SetSymbol } from '../../components/SetSymbol';
import { ManaCost } from '../../components/ManaCost';
import {
  canAnalyse,
  cardCount,
  colorDistribution,
  deckPerformance,
  groupByType,
  manaCurve,
  subtypeCounts,
  typeCounts,
  type CardType,
} from '../../domain/deck';
import { manaColors } from '../../theme/mana';
import type { DeckBoard, DeckCard } from '../../types';

/** Como a decklist se apresenta: com o recorte da arte, ou só texto. */
type DeckView = 'art' | 'compact';

/**
 * O plural do nome do tipo, só para o cabeçalho de grupo ("CREATURES · 14").
 *
 * É formatação da vista e não domínio: `groupByType` devolve o tipo no singular, que é como o
 * schema e a Scryfall o escrevem, e é assim que tem de continuar a sair de lá.
 */
const TYPE_PLURAL: Record<string, string> = {
  Sorcery: 'Sorceries',
  Other: 'Other',
  Unknown: 'No type line',
};

function groupHeading(type: string): string {
  return TYPE_PLURAL[type] ?? `${type}s`;
}

// ─── Blocos ───────────────────────────────────────────────────────────────────

function Section({ label, children, action, right }: {
  label: string;
  children: React.ReactNode;
  action?: { label: string; onPress: () => void };
  /** Um controlo à direita do título — o selector de vista da decklist, por exemplo. */
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>{label}</Text>
        {right}
        {action && (
          <Pressable onPress={action.onPress} hitSlop={10}>
            <Text style={styles.sectionAction}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

/** Curva de mana. A barra mais alta manda na escala — o eixo é relativo, não absoluto. */
function ManaCurveChart({ buckets }: { buckets: ReturnType<typeof manaCurve> }) {
  const tallest = Math.max(...buckets.map(bucket => bucket.count), 1);

  return (
    <View style={curve.row}>
      {buckets.map(bucket => (
        <View key={bucket.cmc} style={curve.column}>
          <Text style={curve.count}>{bucket.count > 0 ? bucket.count : ''}</Text>
          <View style={curve.track}>
            <View
              style={[
                curve.bar,
                {
                  height: `${Math.max((bucket.count / tallest) * 100, bucket.count > 0 ? 6 : 0)}%`,
                },
              ]}
            />
          </View>
          <Text style={curve.axis}>{bucket.isTop ? `${bucket.cmc}+` : bucket.cmc}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Distribuição de cores, como uma barra só repartida.
 *
 * Uma carta de duas cores conta nas duas (ver domain/deck.ts), portanto isto mostra proporção
 * relativa entre cores e não uma fatia de um total — o que é a pergunta certa para um deck.
 */
function ColorBar({ slices }: { slices: ReturnType<typeof colorDistribution> }) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  if (total === 0) return null;

  return (
    <View style={{ gap: 10 }}>
      <View style={colorChart.bar}>
        {slices.map(slice => (
          <View
            key={slice.color}
            style={{ flex: slice.count, backgroundColor: manaColors[slice.color].bg }}
          />
        ))}
      </View>
      <View style={colorChart.legend}>
        {slices.map(slice => (
          <View key={slice.color} style={colorChart.legendItem}>
            <ManaPip color={slice.color} size={15} />
            <Text style={colorChart.legendText}>{slice.count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Contagem por tipo, em linhas com barra proporcional. */
function TypeBreakdown({ counts }: { counts: ReturnType<typeof typeCounts> }) {
  const tallest = Math.max(...counts.map(entry => entry.count), 1);

  return (
    <View style={{ gap: 8 }}>
      {counts.map(entry => (
        <View key={entry.type} style={types.row}>
          <Text style={types.name}>{entry.type}</Text>
          <View style={types.track}>
            <View style={[types.bar, { width: `${(entry.count / tallest) * 100}%` }]} />
          </View>
          <Text style={types.count}>{entry.count}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Subtipos do tipo escolhido, em barras.
 *
 * Ao contrário dos tipos, o nome de um subtipo pode ser longo ("Phyrexian"), e a linha leva também
 * contagem e percentagem — por isso o rótulo fica por cima da barra em vez de ao lado.
 *
 * A escala é relativa ao maior valor, como na curva de mana: o que interessa é comparar subtipos
 * entre si. A percentagem, essa, é absoluta e vem já calculada de `subtypeCounts`.
 */
function SubtypeBreakdown({ rows }: { rows: ReturnType<typeof subtypeCounts> }) {
  const widest = Math.max(...rows.map(row => row.count), 1);

  return (
    <View style={{ gap: 12 }}>
      {rows.map(row => (
        <View key={row.subtype} style={{ gap: 5 }}>
          <View style={subtypes.head}>
            <Text style={subtypes.name} numberOfLines={1}>{row.subtype}</Text>
            <Text style={subtypes.count}>
              {row.count}
              <Text style={subtypes.percent}>{`  ${row.percent}%`}</Text>
            </Text>
          </View>
          <View style={subtypes.track}>
            <View style={[subtypes.bar, { width: `${Math.max((row.count / widest) * 100, 2)}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Escolher o tipo de carta analisado nos subtipos. Chips em vez de dropdown: menos toques. */
function TypeChips({ options, value, onChange }: {
  options: CardType[];
  value: CardType;
  onChange: (type: CardType) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={chips.row}
    >
      {options.map(option => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              chips.chip,
              active && chips.chipActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[chips.label, active && chips.labelActive]}>{groupHeading(option)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Alternar entre a lista com arte e a lista compacta. */
function ViewToggle({ value, onChange }: {
  value: DeckView;
  onChange: (view: DeckView) => void;
}) {
  const options: { mode: DeckView; label: string; icon: 'image' | 'list' }[] = [
    { mode: 'art', label: 'Art', icon: 'image' },
    { mode: 'compact', label: 'Compact', icon: 'list' },
  ];

  return (
    <View style={toggle.group}>
      {options.map(option => {
        const active = option.mode === value;
        return (
          <Pressable
            key={option.mode}
            onPress={() => onChange(option.mode)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${option.label} view`}
            style={({ pressed }) => [
              toggle.option,
              active && toggle.optionActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Feather
              name={option.icon}
              size={13}
              color={active ? colors.bg : colors.textSec}
            />
            <Text style={[toggle.label, active && toggle.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Uma linha da decklist. Tocar abre a carta inteira por cima.
 *
 * A arte é **grande e encostada à margem**: é ela que faz reconhecer a carta de relance, e uma
 * miniatura pequena no meio de espaço vazio lê-se pior do que nome nenhum. O espaçamento entre
 * linhas é curto pela mesma razão — numa lista de quarenta cartas, o ar entre elas é o que obriga a
 * percorrer o écran três vezes.
 */
function CardRow({ card, view, onOpen }: { card: DeckCard; view: DeckView; onOpen: () => void }) {
  if (view === 'compact') {
    return (
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [cardList.compactRow, pressed && { opacity: 0.6 }]}
      >
        <Text style={cardList.quantity}>{card.quantity}×</Text>
        <Text style={cardList.name} numberOfLines={1}>{card.name}</Text>
        <SetSymbol setCode={card.setCode} size={12} />
        <ManaCost cost={card.manaCost} size={13} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [cardList.artRow, pressed && { opacity: 0.6 }]}
    >
      <CardArtThumb url={card.artCropUrl} width={ART_WIDTH} />
      <View style={cardList.artText}>
        <View style={cardList.artNameRow}>
          <SetSymbol setCode={card.setCode} size={13} />
          <Text style={cardList.artName} numberOfLines={1}>{card.name}</Text>
        </View>
        <ManaCost cost={card.manaCost} size={14} />
      </View>
      <Text style={cardList.artQuantity}>{card.quantity}×</Text>
    </Pressable>
  );
}

/**
 * A arte, maior do que estava (era 58×42).
 *
 * A referência do ManaBox usa cerca de 76 de largura num telemóvel de 411 — e sobretudo encosta-a
 * à margem esquerda, o que a faz parecer maior do que o número diz. A proporção é a do `art_crop`
 * da Scryfall (626×457), para não haver corte nem barras.
 */
const ART_WIDTH = 78;
const ART_HEIGHT = artHeightFor(ART_WIDTH);

/**
 * A decklist: primeiro pelo board, depois agrupada por tipo dentro de cada um.
 *
 * O agrupamento e a ordem vêm de `groupByType` — cartas sem linha de tipo caem num grupo próprio no
 * fim em vez de desaparecerem, que é o que acontece a um deck escrito à mão.
 */
function CardList({ cards, view }: { cards: DeckCard[]; view: DeckView }) {
  const [open, setOpen] = useState<DeckCard | undefined>(undefined);

  const boards: { label: string; board: DeckBoard }[] = [
    { label: 'Main', board: 'main' },
    { label: 'Sideboard', board: 'side' },
  ];

  return (
    <View style={{ gap: 20 }}>
      {boards.map(({ label, board }) => {
        const groups = groupByType(cards, board);
        if (groups.length === 0) return null;

        const total = groups.reduce((sum, group) => sum + group.count, 0);

        return (
          <View key={board} style={{ gap: 14 }}>
            <Text style={cardList.boardLabel}>{label} · {total}</Text>

            {groups.map(group => (
              <View key={group.type} style={{ gap: view === 'art' ? 3 : 2 }}>
                <View style={cardList.groupHeader}>
                  <Text style={cardList.groupLabel}>
                    {groupHeading(group.type)} · {group.count}
                  </Text>
                  <View style={cardList.groupRule} />
                </View>

                {group.cards.map((card, index) => (
                  <CardRow
                    key={`${board}-${group.type}-${card.name}-${index}`}
                    card={card}
                    view={view}
                    onOpen={() => setOpen(card)}
                  />
                ))}
              </View>
            ))}
          </View>
        );
      })}

      <CardImageOverlay card={open} onClose={() => setOpen(undefined)} />
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const deck = useEventsStore(s => s.decks.find(d => d.id === id));
  const events = useEventsStore(s => s.events);

  // Estado de vista. Os hooks ficam antes do early return do deck que não existe — a ordem dos
  // hooks não pode depender de condições.
  const [view, setView] = useState<DeckView>('art');
  const [chosenType, setChosenType] = useState<CardType | null>(null);

  // Só entram no selector os tipos que este deck tem **e** que dão subtipos: um deck cheio de
  // instants não deve oferecer uma opção que abre num gráfico vazio.
  const subtypeOptions = useMemo(
    () =>
      typeCounts(deck?.cards)
        .map(entry => entry.type)
        .filter(type => subtypeCounts(deck?.cards, type).length > 0),
    [deck?.cards],
  );

  // As criaturas são a leitura habitual, como na app de referência; se o deck não tiver nenhuma,
  // vale o primeiro tipo disponível. Uma escolha que deixe de existir volta ao valor por omissão.
  const activeType: CardType | undefined =
    (chosenType && subtypeOptions.includes(chosenType) ? chosenType : undefined) ??
    (subtypeOptions.includes('Creature') ? 'Creature' : subtypeOptions[0]);

  const subtypeRows = useMemo(
    () => (activeType ? subtypeCounts(deck?.cards, activeType) : []),
    [deck?.cards, activeType],
  );

  if (!deck) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="chevron-left" size={24} color={colors.textSec} />
          </Pressable>
        </View>
        <View style={styles.missing}>
          <Text style={styles.missingText}>This deck no longer exists.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const performance = deckPerformance(deck.id, events);
  const playedIn = events.filter(event => event.deckId === deck.id);
  const total = cardCount(deck.cards, 'main');
  const sideTotal = cardCount(deck.cards, 'side');

  const curve = manaCurve(deck.cards);
  const slices = colorDistribution(deck.cards);
  const counts = typeCounts(deck.cards);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="chevron-left" size={24} color={colors.textSec} />
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/deck-editor', params: { deckId: deck.id } })}
          hitSlop={10}
        >
          <Text style={styles.editBtn}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.name}>{deck.name}</Text>

          <View style={styles.pips}>
            {deck.colors.main.map(c => <ManaPip key={`m-${c}`} color={c} size={20} />)}
            {deck.colors.splash.map(c => <ManaPip key={`s-${c}`} color={c} size={20} isSplash />)}
          </View>

          <View style={styles.badges}>
            {deck.format && <TypeBadge type={deck.format} />}
            {deck.archetype && <Text style={styles.archetype}>{deck.archetype}</Text>}
          </View>
        </View>

        {/* Desempenho */}
        <View style={stats.bar}>
          <View style={stats.cell}>
            <Text style={stats.record}>
              {performance.wins} – {performance.losses} – {performance.draws}
            </Text>
            <Text style={stats.label}>W – L – D</Text>
          </View>
          <View style={stats.divider} />
          <View style={stats.cell}>
            <Text style={stats.big}>{performance.winRate}%</Text>
            <Text style={stats.label}>Win Rate</Text>
          </View>
          <View style={stats.divider} />
          <View style={stats.cell}>
            <Text style={stats.big}>{performance.events}</Text>
            <Text style={stats.label}>Events</Text>
          </View>
        </View>

        {performance.events === 0 && (
          <Text style={styles.hint}>
            Not played yet. Link it to an event from that event's screen.
          </Text>
        )}

        {/* Eventos jogados com este deck */}
        {playedIn.length > 0 && (
          <Section label="Played in">
            {playedIn.map(event => (
              <Pressable
                key={event.id}
                style={({ pressed }) => [played.row, pressed && { opacity: 0.7 }]}
                onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={played.name} numberOfLines={1}>{event.name}</Text>
                  <Text style={played.date}>{event.date}{event.rank ? ` · ${event.rank}` : ''}</Text>
                </View>
                <Feather name="chevron-right" size={14} color={colors.textDim} />
              </Pressable>
            ))}
          </Section>
        )}

        {/* Análise — só quando há material para ela */}
        {canAnalyse(deck) ? (
          <>
            {curve.length > 0 && (
              <Section label="Mana curve">
                <ManaCurveChart buckets={curve} />
                <Text style={styles.chartNote}>Lands excluded.</Text>
              </Section>
            )}

            {slices.length > 0 && (
              <Section label="Colors">
                <ColorBar slices={slices} />
              </Section>
            )}

            {counts.length > 0 && (
              <Section label="Types">
                <TypeBreakdown counts={counts} />
              </Section>
            )}

            {activeType && subtypeRows.length > 0 && (
              <Section label="Subtypes">
                <SubtypeBreakdown rows={subtypeRows} />
                {subtypeOptions.length > 1 && (
                  <View style={styles.chipsWrap}>
                    <TypeChips
                      options={subtypeOptions}
                      value={activeType}
                      onChange={setChosenType}
                    />
                  </View>
                )}
                <Text style={styles.chartNote}>
                  Share of all subtypes counted, not of the cards.
                </Text>
              </Section>
            )}
          </>
        ) : (
          <Section label="Decklist">
            <Text style={styles.hint}>
              No cards yet. Card search arrives in Phase 3 — until then this deck still tracks its
              record across events.
            </Text>
          </Section>
        )}

        {/* Lista de cartas */}
        {deck.cards && deck.cards.length > 0 && (
          <Section
            label={`Decklist · ${total}${sideTotal > 0 ? ` + ${sideTotal}` : ''}`}
            right={<ViewToggle value={view} onChange={setView} />}
          >
            <CardList cards={deck.cards} view={view} />
          </Section>
        )}

        {deck.notes && (
          <Section label="Notes">
            <Text style={styles.notes}>{deck.notes}</Text>
          </Section>
        )}
      </ScrollView>
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
  editBtn: { fontFamily: fonts.body, fontSize: 16, color: colors.gold },
  content: { paddingBottom: 48 },
  header: { paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  name: { fontFamily: fonts.display, fontSize: 27, color: colors.textPrim, lineHeight: 34 },
  pips: { flexDirection: 'row', gap: 5 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  archetype: { fontFamily: fonts.bodyItal, fontSize: 14, color: colors.textSec },
  hint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textDim,
    lineHeight: 21,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  chartNote: {
    fontFamily: fonts.bodyItal,
    fontSize: 12,
    color: colors.textDim,
    marginTop: 8,
  },
  chipsWrap: { marginTop: 16, marginHorizontal: -20 },
  notes: { fontFamily: fonts.body, fontSize: 15, color: colors.textSec, lineHeight: 23 },
  section: { paddingHorizontal: 20, marginBottom: 26 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  sectionLabel: {
    flexShrink: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  sectionAction: { fontFamily: fonts.body, fontSize: 13, color: colors.gold },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { fontFamily: fonts.body, fontSize: 15, color: colors.textSec },
});

const stats = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    marginBottom: 24,
  },
  cell: { flex: 1, alignItems: 'center', gap: 3 },
  divider: { width: 1, height: 32, backgroundColor: colors.border },
  record: { fontFamily: fonts.displaySemi, fontSize: 19, color: colors.textPrim },
  big: { fontFamily: fonts.display, fontSize: 22, color: colors.gold },
  label: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
});

const curve = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 150 },
  column: { flex: 1, alignItems: 'center', gap: 4 },
  count: { fontFamily: fonts.body, fontSize: 11, color: colors.textDim, height: 14 },
  track: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: colors.gold, borderRadius: 3, minHeight: 2 },
  axis: { fontFamily: fonts.displayMed, fontSize: 12, color: colors.textSec },
});

const colorChart = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontFamily: fonts.bodyMed, fontSize: 13, color: colors.textSec },
});

const types = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: fonts.body, fontSize: 13, color: colors.textSec, width: 92 },
  track: { flex: 1, height: 8, backgroundColor: colors.border + '55', borderRadius: 4 },
  bar: { height: 8, backgroundColor: colors.goldDim, borderRadius: 4 },
  count: { fontFamily: fonts.displayMed, fontSize: 13, color: colors.textPrim, width: 26, textAlign: 'right' },
});

const subtypes = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  name: { flexShrink: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textPrim },
  count: { fontFamily: fonts.displayMed, fontSize: 13, color: colors.textSec },
  percent: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  track: { height: 8, backgroundColor: colors.border + '55', borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, backgroundColor: colors.goldDim, borderRadius: 4 },
});

const chips = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 20 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.bgCardHov },
  label: { fontFamily: fonts.body, fontSize: 13, color: colors.textSec },
  labelActive: { fontFamily: fonts.bodyMed, color: colors.gold },
});

const toggle = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  optionActive: { backgroundColor: colors.gold },
  label: { fontFamily: fonts.body, fontSize: 13, color: colors.textSec },
  labelActive: { fontFamily: fonts.bodyMed, color: colors.bg },
});

const cardList = StyleSheet.create({
  boardLabel: {
    fontFamily: fonts.displayMed,
    fontSize: 15,
    color: colors.textPrim,
  },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  groupLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.goldDim,
  },
  groupRule: { flex: 1, height: 1, backgroundColor: colors.border + '88' },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 32,
  },
  artRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    // A arte encosta à margem esquerda: a secção tem 20 de padding e a linha desfá-lo só do lado
    // de fora. É isto que a faz parecer maior, mais do que o número de pixels.
    marginLeft: -20,
    paddingRight: 2,
  },
  artText: { flex: 1, gap: 3 },
  artNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  artName: { flex: 1, fontFamily: fonts.bodyMed, fontSize: 16, color: colors.textPrim },
  artQuantity: {
    fontFamily: fonts.displayMed,
    fontSize: 15,
    color: colors.textSec,
    minWidth: 30,
    textAlign: 'right',
  },
  quantity: {
    fontFamily: fonts.displayMed,
    fontSize: 13,
    color: colors.textDim,
    width: 26,
  },
  name: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textPrim },
  cost: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
});

const played = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '66',
  },
  name: { fontFamily: fonts.bodyMed, fontSize: 15, color: colors.textPrim },
  date: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
});
