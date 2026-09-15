// Stats Screen
// Design ref: design prints provided by user (2026-05-10)

import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Rect, Line, Circle, G, Text as SvgText } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { ManaColor, Event, Opponent, isActive } from '../../types';
import { useEventsStore } from '../../store/useEventsStore';
import { ManaPip } from '../../components/ManaPip';
import { RecordBadge } from '../../components/RecordBadge';
import {
  MIN_HIGHLIGHT_ENCOUNTERS,
  OpponentRecord,
  favouriteMatchup,
  nemesis,
  rankOpponents,
} from '../../domain/opponents';
import { compareDates, monthLabel } from '../../domain/dates';
import {
  TIERS,
  Tier,
  bestFinish,
  hasStanding,
  tierCounts,
  tierLabel,
  trendPoint,
} from '../../domain/placement';

const SCREEN_W   = Dimensions.get('window').width;
const MANA_ORDER: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

// ─── Escalões ─────────────────────────────────────────────────────────────────

/**
 * Os degraus da pirâmide. A largura e a cor são desenho; **os escalões em si vêm de
 * `domain/placement.ts`** e deduzem-se da posição final de cada evento — nenhum ficheiro guarda
 * "Top 8" (ADR 0012).
 *
 * O último degrau não é um escalão: é o balde de quem chegou ao fim do torneio fora de todos eles,
 * e existe para as percentagens dos outros serem sobre os torneios todos e não só sobre os bons.
 */
const TIER_STYLE: Record<Tier, { color: string; pct: number }> = {
  1:  { color: '#C9A96E', pct: 0.42 },
  2:  { color: '#B8904A', pct: 0.54 },
  4:  { color: '#A07840', pct: 0.64 },
  8:  { color: '#7A6855', pct: 0.74 },
  16: { color: '#5A6268', pct: 0.83 },
  32: { color: '#4A5858', pct: 0.91 },
};

const OUTSIDE_STYLE = { color: '#606060', pct: 1.00 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getColorStats(events: Event[], color: ManaColor) {
  const relevant = events.filter(e => e.deckColors?.main?.includes(color));
  if (!relevant.length) return null;
  const wins  = relevant.reduce((s, e) => s + e.matches.filter(m => m.result === 'W').length, 0);
  const total = relevant.reduce((s, e) => s + e.matches.length, 0);
  return { wins, total, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 };
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, right }: { title: string; right?: string }) {
  return (
    <View style={sh.row}>
      <View style={sh.accentBar} />
      <Text style={sh.title}>{title}</Text>
      {right ? <Text style={sh.right}>{right}</Text> : null}
    </View>
  );
}

const sh = StyleSheet.create({
  row: {
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
    backgroundColor: colors.gold,
  },
  title: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
  },
  right: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
  },
});

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ events }: { events: Event[] }) {
  const totalMatches = events.reduce((s, e) => s + e.matches.length, 0);
  const wins         = events.reduce((s, e) => s + e.matches.filter(m => m.result === 'W').length, 0);
  const losses       = events.reduce((s, e) => s + e.matches.filter(m => m.result === 'L').length, 0);
  const draws        = events.reduce((s, e) => s + e.matches.filter(m => m.result === 'D').length, 0);
  const wr           = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  return (
    <View style={summary.card}>
      {/* Events cell */}
      <View style={summary.cell}>
        <Text style={summary.label}>EVENTS</Text>
        <Text style={summary.bigNum}>{events.length}</Text>
        <Text style={summary.sub}>played</Text>
      </View>

      <View style={summary.divider} />

      {/* Win Rate cell */}
      <View style={summary.cell}>
        <Text style={summary.label}>WIN RATE</Text>
        <Text style={[summary.bigNum, { color: colors.gold }]}>{wr}<Text style={summary.pct}>%</Text></Text>
        <View style={summary.wld}>
          <Text style={[summary.wldNum, { color: colors.win }]}>{wins}</Text>
          <Text style={summary.wldSep}> – </Text>
          <Text style={[summary.wldNum, { color: colors.loss }]}>{losses}</Text>
          <Text style={summary.wldSep}> – </Text>
          <Text style={[summary.wldNum, { color: colors.draw }]}>{draws}</Text>
        </View>
      </View>
    </View>
  );
}

const summary = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 2,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  label: {
    fontFamily: fonts.bodyItal,
    fontSize: 10,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  bigNum: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.textPrim,
    lineHeight: 40,
    includeFontPadding: false,
  },
  pct: {
    fontSize: 20,
  },
  sub: {
    fontFamily: fonts.bodyItal,
    fontSize: 12,
    color: colors.textSec,
    marginTop: 2,
  },
  wld: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  wldNum: {
    fontFamily: fonts.displaySemi,
    fontSize: 13,
  },
  wldSep: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
  },
});

// ─── Trend Chart ──────────────────────────────────────────────────────────────

const SVG_W        = SCREEN_W - 32;
const SVG_H        = 200;
const PAD_LEFT     = 44;
const PAD_RIGHT    = 8;
const PAD_TOP      = 8;
const PAD_BOTTOM   = 22;
const PLOT_W       = SVG_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H       = SVG_H - PAD_TOP - PAD_BOTTOM;

/**
 * O eixo é **quanto do campo ficou atrás**, de 0 a 1 — e não a posição.
 *
 * A posição sozinha não se compara entre torneios: um 5.º lugar entre 8 e um 5.º entre 128 davam a
 * mesma barra e não são a mesma coisa. Com o campo pelo meio, ganhar é sempre o topo e o resto
 * arruma-se pela dificuldade (ADR 0012).
 */
const Y_GRID = [
  { value: 1.00, label: '100%' },
  { value: 0.75, label: '75%' },
  { value: 0.50, label: '50%' },
  { value: 0.25, label: '25%' },
];

function valueToY(value: number): number {
  return PAD_TOP + PLOT_H * (1 - value);
}

function TrendChart({ events }: { events: Event[] }) {
  const points = events
    .slice()
    .sort((a, b) => compareDates(a.date, b.date))
    .map(event => ({ event, point: trendPoint(event) }))
    .filter((entry): entry is { event: Event; point: NonNullable<ReturnType<typeof trendPoint>> } =>
      entry.point !== null,
    );

  if (!points.length) {
    return (
      <View style={chart.empty}>
        <Text style={chart.emptyText}>Complete events with a finishing position to see the trend.</Text>
      </View>
    );
  }

  const N        = points.length;
  const slotW    = PLOT_W / N;
  const barW     = Math.max(6, Math.min(16, slotW * 0.55));
  const baseY    = valueToY(0);

  const barCx = (i: number) => PAD_LEFT + i * slotW + slotW / 2;

  // Há barras estimadas quando algum evento só tem o escalão antigo. Desde a Q15 os eventos novos
  // trazem sempre a posição e o campo, portanto isto é exclusivamente sinal de legado — e o dia em
  // que não houver nenhum desses é o dia em que a legenda desaparece sozinha.
  const anyEstimated = points.some(entry => entry.point.estimated);

  // X-axis labels — only when month changes
  const xLabels: { cx: number; label: string }[] = [];
  let lastMonth = '';
  points.forEach(({ event }, i) => {
    const m = monthLabel(event.date);
    if (m && m !== lastMonth) {
      xLabels.push({ cx: barCx(i), label: m });
      lastMonth = m;
    }
  });

  return (
    <View style={chart.card}>
      <Svg width={SVG_W} height={SVG_H}>
        {/* Grid lines */}
        {Y_GRID.map(({ value, label }) => {
          const y = valueToY(value);
          return (
            <G key={label}>
              <Line
                x1={PAD_LEFT} y1={y}
                x2={SVG_W - PAD_RIGHT} y2={y}
                stroke={colors.border}
                strokeWidth={0.8}
                strokeDasharray="3,4"
              />
              <SvgText
                x={PAD_LEFT - 4} y={y + 3.5}
                fontSize={8}
                fontFamily={fonts.bodyItal}
                fill={colors.textDim}
                textAnchor="end"
              >
                {label}
              </SvgText>
            </G>
          );
        })}

        {/* Bars — a barra estimada fica apagada, para não se ler como uma medição */}
        {points.map(({ event, point }, i) => {
          const topY   = valueToY(point.value);
          const barH   = baseY - topY;
          const x      = barCx(i) - barW / 2;

          return (
            <G key={event.id}>
              <Rect
                x={x} y={topY}
                width={barW} height={barH}
                fill={colors.gold}
                fillOpacity={point.estimated ? 0.22 : 0.65}
                rx={2}
              />
              <Circle
                cx={barCx(i)} cy={topY}
                r={3}
                fill={colors.gold}
                fillOpacity={point.estimated ? 0.4 : 1}
              />
            </G>
          );
        })}

        {/* X labels */}
        {xLabels.map(({ cx, label }) => (
          <SvgText
            key={label + cx}
            x={cx} y={SVG_H - 5}
            fontSize={9}
            fontFamily={fonts.body}
            fill={colors.textDim}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ))}
      </Svg>

      {anyEstimated && (
        <Text style={chart.legend}>
          Faded bars are estimated from an older bracket-only record, not measured.
        </Text>
      )}
    </View>
  );
}

const chart = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 24,
  },
  empty: {
    marginHorizontal: 16,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontFamily: fonts.bodyItal,
    fontSize: 13,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
  legend: {
    fontFamily: fonts.bodyItal,
    fontSize: 10,
    color: colors.textDim,
    paddingHorizontal: 12,
    paddingBottom: 10,
    lineHeight: 14,
  },
});

// ─── By Color ─────────────────────────────────────────────────────────────────

const PIP_SIZE = 44;

function ColorSection({ events }: { events: Event[] }) {
  const allStats = MANA_ORDER.map(c => ({ color: c, stats: getColorStats(events, c) }));
  const withData = allStats.filter(cs => cs.stats !== null);
  const bestColor = withData.length > 0
    ? withData.reduce((best, cs) =>
        cs.stats!.winRate > best.stats!.winRate ? cs : best
      ).color
    : null;

  return (
    <View style={byColor.card}>
      {allStats.map(({ color, stats }) => {
        const isBest = color === bestColor;
        return (
          <View key={color} style={byColor.col}>
            {/* Pip with optional gold ring */}
            <View style={byColor.pipWrap}>
              {isBest && <View style={byColor.goldRing} />}
              <View style={{ opacity: stats ? 1 : 0.35 }}>
                <ManaPip color={color} size={PIP_SIZE} />
              </View>
              {isBest && <Text style={byColor.star}>★</Text>}
            </View>

            {/* Win rate */}
            <Text style={[byColor.wr, !stats && byColor.wrDash]}>
              {stats ? `${stats.winRate}%` : '—'}
            </Text>

            {/* Games count */}
            <Text style={byColor.games}>
              {stats ? `${stats.wins}/${stats.total}` : '—'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const byColor = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    paddingVertical: 18,
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  pipWrap: {
    width: PIP_SIZE + 10,
    height: PIP_SIZE + 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  goldRing: {
    position: 'absolute',
    width: PIP_SIZE + 10,
    height: PIP_SIZE + 10,
    borderRadius: (PIP_SIZE + 10) / 2,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  star: {
    position: 'absolute',
    top: -2,
    right: -2,
    fontSize: 10,
    color: colors.gold,
  },
  wr: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.textPrim,
  },
  wrDash: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 18,
  },
  games: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textDim,
    textAlign: 'center',
  },
});

// ─── Opponents ────────────────────────────────────────────────────────────────

// Quantos adversários a lista mostra antes de se resumir. Seis chega para a pergunta ("quem é que
// eu enfrento mais vezes?") sem transformar o écran de stats numa lista de contactos.
const OPPONENTS_SHOWN = 6;

/**
 * Um destaque: o nemesis ou o melhor matchup.
 *
 * A borda e o número são tingidos de derrota ou de vitória porque é a leitura que interessa à
 * distância — o nome vem depois.
 */
function Highlight({ label, record, tone }: {
  label: string;
  record: OpponentRecord;
  tone: 'win' | 'loss';
}) {
  const accent = tone === 'win' ? colors.win : colors.loss;
  const background = tone === 'win' ? colors.winBg : colors.lossBg;
  const borderColor = tone === 'win' ? colors.winBorder : colors.lossBorder;

  return (
    <View style={[opp.highlight, { backgroundColor: background, borderColor }]}>
      <Text style={[opp.highlightLabel, { color: accent }]}>{label}</Text>
      <Text style={opp.highlightName} numberOfLines={1}>{record.name}</Text>
      <Text style={opp.highlightMeta}>
        <Text style={[opp.highlightRate, { color: accent }]}>{record.winRate}%</Text>
        {`  ${record.wins}–${record.losses}${record.draws > 0 ? `–${record.draws}` : ''}`}
      </Text>
      <Text style={opp.highlightMeta}>
        {record.played === 1 ? '1 match' : `${record.played} matches`}
      </Text>
    </View>
  );
}

/**
 * Uma linha da lista. Toca-se para abrir o écran do adversário.
 *
 * **Porque é que o histórico deixou de abrir aqui dentro.** Abria-o em acordeão, e passou a haver
 * um écran (`opponent/[id]`) que mostra o mesmo e mais — o registo, as cores de cada encontro, e um
 * toque que leva ao evento. Manter os dois seria mostrar a mesma coisa em dois sítios, que é como
 * se ganha a hipótese de divergirem; e um confronto que se toca para abrir o evento dentro de uma
 * linha que já é um botão são dois alvos de toque empilhados, o pior caso para um dedo apressado.
 * As Stats ficam com a pergunta de resumo — quem é que eu enfrento mais vezes — e o detalhe mudou-se
 * para onde há espaço para ele.
 */
function OpponentRow({ record, onPress }: {
  record: OpponentRecord;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [opp.row, pressed && { backgroundColor: colors.bgCardHov }]}
    >
      <View style={opp.rowMain}>
        <View style={opp.rowInfo}>
          <Text style={opp.name} numberOfLines={1}>{record.name}</Text>
          <Text style={opp.meta} numberOfLines={1}>
            {record.played === 1 ? '1 match' : `${record.played} matches`}
            {' · '}
            {record.events === 1 ? '1 event' : `${record.events} events`}
            {record.draws > 0 ? (record.draws === 1 ? ' · 1 draw' : ` · ${record.draws} draws`) : ''}
          </Text>
        </View>

        <RecordBadge wins={record.wins} losses={record.losses} draws={record.draws} />

        <Feather
          name="chevron-right"
          size={14}
          color={colors.textDim}
          style={opp.chevron}
        />
      </View>
    </Pressable>
  );
}

/**
 * A secção inteira.
 *
 * As contas estão em `domain/opponents.ts` — aqui só se desenha. A ordem da lista é a do
 * `rankOpponents` (mais enfrentados primeiro) e não a do win rate; o porquê está lá explicado.
 */
function OpponentsSection({ events, opponents }: { events: Event[]; opponents: Opponent[] }) {
  const ranked = useMemo(() => rankOpponents(opponents, events), [opponents, events]);
  const faced = useMemo(() => ranked.filter(record => record.played > 0), [ranked]);
  const worst = useMemo(() => nemesis(opponents, events), [opponents, events]);
  const best = useMemo(() => favouriteMatchup(opponents, events), [opponents, events]);

  // Sem eventos registados não há aqui nada a dizer — e é o caso normal de quem abre a app pela
  // primeira vez, não uma falha a disfarçar com gráficos vazios.
  if (faced.length === 0) {
    return (
      <View style={opp.empty}>
        <Text style={opp.emptyText}>
          No opponents yet. Register a match and your record against each player starts here.
        </Text>
      </View>
    );
  }

  // Com um só candidato o nemesis e o melhor matchup são a mesma pessoa. Mostrar as duas etiquetas
  // sobre o mesmo nome seria ridículo: fica a que o registo justifica.
  const sameOne = worst && best && worst.opponentId === best.opponentId;
  const soloTone: 'win' | 'loss' = worst && worst.winRate >= 50 ? 'win' : 'loss';

  return (
    <View style={opp.section}>
      {worst && best && (
        <View style={opp.highlights}>
          {sameOne ? (
            <Highlight
              label={soloTone === 'win' ? 'BEST MATCHUP' : 'NEMESIS'}
              record={worst}
              tone={soloTone}
            />
          ) : (
            <>
              <Highlight label="NEMESIS" record={worst} tone="loss" />
              <Highlight label="BEST MATCHUP" record={best} tone="win" />
            </>
          )}
        </View>
      )}

      {/* Porque é que ainda não há destaques — melhor do que um espaço vazio sem explicação */}
      {!worst && (
        <Text style={opp.note}>
          Nemesis and best matchup need {MIN_HIGHLIGHT_ENCOUNTERS} matches against the same player.
        </Text>
      )}

      <View style={opp.card}>
        {faced.slice(0, OPPONENTS_SHOWN).map((record, index) => (
          <View key={record.opponentId}>
            {index > 0 && <View style={opp.divider} />}
            <OpponentRow
              record={record}
              onPress={() =>
                router.push({
                  pathname: '/opponent/[id]',
                  params: { id: record.opponentId },
                })
              }
            />
          </View>
        ))}
      </View>

      {faced.length > OPPONENTS_SHOWN && (
        <Text style={opp.note}>
          + {faced.length - OPPONENTS_SHOWN} more opponents faced.
        </Text>
      )}
    </View>
  );
}

const opp = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  highlights: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  highlight: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 2,
  },
  highlightLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  highlightName: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.textPrim,
  },
  highlightMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textDim,
  },
  highlightRate: {
    fontFamily: fonts.displaySemi,
    fontSize: 12,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  row: {
    // 44 px de alvo de toque mínimo, com folga: a app usa-se de pé numa loja
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.textPrim,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textDim,
  },
  chevron: {
    marginLeft: 2,
  },
  empty: {
    marginHorizontal: 16,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontFamily: fonts.bodyItal,
    fontSize: 13,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
  note: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    marginHorizontal: 16,
    marginTop: 8,
  },
});

// ─── Positions Pyramid ────────────────────────────────────────────────────────

// Pyramid row occupies a centered portion; percentage label sits outside to the right.
// A phantom spacer on the left mirrors the percentage width so rows stay centred.
const PCT_W      = 40;  // width of right percentage label area (and left phantom spacer)
const PYRAMID_MAX = SCREEN_W - 32 - PCT_W * 2; // max row width for 100% tier

function PositionsPyramid({ events }: { events: Event[] }) {
  // Um só varrimento pelos eventos, em vez de um por degrau — e os escalões saem da posição final.
  const { byTier, outside, total } = tierCounts(events);

  const rows = [
    ...TIERS.map(tier => ({ key: tierLabel(tier), count: byTier[tier], ...TIER_STYLE[tier] })),
    { key: 'Outside', count: outside, ...OUTSIDE_STYLE },
  ];

  return (
    <View style={pyramid.outer}>
      {rows.map(tier => {
        const count  = tier.count;
        const pct    = total > 0 ? Math.round((count / total) * 100) : 0;
        const rowW   = Math.round(tier.pct * PYRAMID_MAX);

        return (
          <View key={tier.key} style={pyramid.tierWrapper}>
            {/* Left phantom spacer — keeps row centred */}
            <View style={{ width: PCT_W }} />

            {/* Pyramid row */}
            <View style={[
              pyramid.row,
              { width: rowW, borderColor: tier.color + '55', backgroundColor: tier.color + '18' },
            ]}>
              <Text style={[pyramid.tierLabel, { color: tier.color }]}>{tier.key}</Text>
              {count > 0
                ? <Text style={[pyramid.count, { color: tier.color }]}>{count}</Text>
                : <Text style={pyramid.noResult}>no result yet</Text>
              }
            </View>

            {/* Right: percentage of all ranked events */}
            <View style={{ width: PCT_W, alignItems: 'flex-start', paddingLeft: 8 }}>
              {count > 0 && (
                <Text style={[pyramid.pct, { color: tier.color + 'BB' }]}>{pct}%</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const pyramid = StyleSheet.create({
  outer: {
    marginHorizontal: 16,
    gap: 4,
    marginBottom: 32,
  },
  tierWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  tierLabel: {
    fontFamily: fonts.bodyItal,
    fontSize: 13,
  },
  count: {
    fontFamily: fonts.display,
    fontSize: 20,
    includeFontPadding: false,
  },
  noResult: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
  },
  pct: {
    fontFamily: fonts.bodyMed,
    fontSize: 12,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const events = useEventsStore(s => s.events);
  const opponents = useEventsStore(s => s.opponents);

  const trendEvents = events.filter(e => !isActive(e) && hasStanding(e));
  const best        = bestFinish(events);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.archiveLabel}>battle archive</Text>
          <Text style={styles.title}>Stats</Text>
        </View>

        <SummaryCard events={events} />

        <SectionHeader title="Trend" right={`${trendEvents.length} events`} />
        <TrendChart events={events} />

        <SectionHeader title="By Color" />
        <ColorSection events={events} />

        <SectionHeader title="Opponents" />
        <OpponentsSection events={events} opponents={opponents} />

        <SectionHeader title="Positions Reached" right={best && `best ${best}`} />
        <PositionsPyramid events={events} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  archiveLabel: {
    fontFamily: fonts.displayItal,
    fontSize: 11,
    color: colors.goldDim,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.textPrim,
    lineHeight: 34,
  },
});
