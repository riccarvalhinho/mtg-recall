// Stats Screen
// Design ref: design prints provided by user (2026-05-10)

import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Line, Circle, G, Text as SvgText } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { ManaColor, Event } from '../../types';
import { useEventsStore } from '../../store/useEventsStore';
import { ManaPip } from '../../components/ManaPip';

const SCREEN_W   = Dimensions.get('window').width;
const MANA_ORDER: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Rank helpers ─────────────────────────────────────────────────────────────

const RANK_TO_LEVEL: Record<string, number> = {
  'Top 32': 1, 'Top 16': 2, 'Top 8': 3, 'Top 4': 4, 'Top 2': 5, '1st Place': 6,
};

const RANK_TIERS: { key: string; color: string; pct: number }[] = [
  { key: '1st Place', color: '#C9A96E', pct: 0.42 },
  { key: 'Top 2',    color: '#B8904A', pct: 0.54 },
  { key: 'Top 4',    color: '#A07840', pct: 0.64 },
  { key: 'Top 8',    color: '#7A6855', pct: 0.74 },
  { key: 'Top 16',   color: '#5A6268', pct: 0.83 },
  { key: 'Top 32',   color: '#4A5858', pct: 0.91 },
  { key: 'Other',    color: '#606060', pct: 1.00 },
];

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
const MAX_LEVEL    = 6;

const Y_GRID = [
  { level: 6, label: '1st' },
  { level: 5, label: '2nd' },
  { level: 4, label: 'Top 4' },
  { level: 3, label: 'Top 8' },
  { level: 2, label: 'Top 16' },
];

function levelToY(level: number): number {
  return PAD_TOP + PLOT_H * (1 - level / MAX_LEVEL);
}

function TrendChart({ events }: { events: Event[] }) {
  const ranked = events
    .filter(e => !e.active && e.rank && RANK_TO_LEVEL[e.rank] !== undefined)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (!ranked.length) {
    return (
      <View style={chart.empty}>
        <Text style={chart.emptyText}>Complete events with a ranking to see the trend.</Text>
      </View>
    );
  }

  const N        = ranked.length;
  const slotW    = PLOT_W / N;
  const barW     = Math.max(6, Math.min(16, slotW * 0.55));
  const baseY    = levelToY(0);

  const barCx = (i: number) => PAD_LEFT + i * slotW + slotW / 2;

  // X-axis labels — only when month changes
  const xLabels: { cx: number; label: string }[] = [];
  let lastMonth = '';
  ranked.forEach((e, i) => {
    const m = MONTHS[new Date(e.date).getMonth()];
    if (m !== lastMonth) {
      xLabels.push({ cx: barCx(i), label: m });
      lastMonth = m;
    }
  });

  return (
    <View style={chart.card}>
      <Svg width={SVG_W} height={SVG_H}>
        {/* Grid lines */}
        {Y_GRID.map(({ level, label }) => {
          const y = levelToY(level);
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

        {/* Bars */}
        {ranked.map((event, i) => {
          const level  = RANK_TO_LEVEL[event.rank!];
          const topY   = levelToY(level);
          const barH   = baseY - topY;
          const x      = barCx(i) - barW / 2;

          return (
            <G key={event.id}>
              <Rect
                x={x} y={topY}
                width={barW} height={barH}
                fill={colors.gold}
                fillOpacity={0.65}
                rx={2}
              />
              <Circle
                cx={barCx(i)} cy={topY}
                r={3}
                fill={colors.gold}
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

// ─── Positions Pyramid ────────────────────────────────────────────────────────

// Pyramid row occupies a centered portion; percentage label sits outside to the right.
// A phantom spacer on the left mirrors the percentage width so rows stay centred.
const PCT_W      = 40;  // width of right percentage label area (and left phantom spacer)
const PYRAMID_MAX = SCREEN_W - 32 - PCT_W * 2; // max row width for 100% tier

function PositionsPyramid({ events }: { events: Event[] }) {
  const totalRanked = events.filter(e => e.rank).length;

  return (
    <View style={pyramid.outer}>
      {RANK_TIERS.map(tier => {
        const count  = events.filter(e => e.rank === tier.key).length;
        const pct    = totalRanked > 0 ? Math.round((count / totalRanked) * 100) : 0;
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

  const trendEvents = events.filter(e => !e.active && e.rank && RANK_TO_LEVEL[e.rank] !== undefined);

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

        <SectionHeader title="Positions Reached" />
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
