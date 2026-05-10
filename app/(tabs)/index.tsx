// Home Screen — MTG Recall
// Spec: design/handoff.md § 3

import { useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts, fontSize } from '../../theme/typography';
import { ManaPip } from '../../components/ManaPip';
import { EventCard } from '../../components/EventCard';
import { ManaColor, Event } from '../../types';
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

// ─── OrnamentDivider ──────────────────────────────────────────────────────────

function OrnamentDivider() {
  return (
    <View style={divider.container}>
      <View style={divider.line} />
      <Text style={divider.star}>✦</Text>
      <View style={divider.line} />
    </View>
  );
}

const divider = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 16, gap: 10 },
  line:      { flex: 1, height: 1, backgroundColor: colors.border },
  star:      { color: colors.goldDim, fontSize: 10 },
});

// ─── Secção: Evento Activo ────────────────────────────────────────────────────

function ActiveEventSection({ event }: { event: Event }) {
  const round = event.matches.length + 1;

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

      <EventCard event={event} onPress={() => router.push(`/event/${event.id}`)} />

      {/* Botão Adicionar Match */}
      <Pressable
        style={({ pressed }) => [active.addBtn, pressed && { opacity: 0.8 }]}
        onPress={goToMatch}
      >
        <LinearGradient
          colors={[colors.gold + '33', colors.gold + '11']}
          style={active.addBtnCircle}
        >
          <Text style={active.addBtnPlus}>+</Text>
        </LinearGradient>
        <View>
          <Text style={active.addBtnText}>Add Match</Text>
          <Text style={active.addBtnSub}>Round {round} · {event.name}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.textDim} style={{ marginLeft: 'auto' }} />
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gold + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnPlus: {
    color: colors.gold,
    fontSize: 18,
    lineHeight: 22,
    includeFontPadding: false,
  },
  addBtnText: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    color: colors.textPrim,
  },
  addBtnSub: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textSec,
    marginTop: 1,
  },
});

// ─── Secção: Eventos Recentes ─────────────────────────────────────────────────

function RecentEventsSection({ events }: { events: Event[] }) {
  return (
    <View>
      <View style={recent.header}>
        <Text style={recent.label}>Recent Events</Text>
        <Pressable onPress={() => router.push('/(tabs)/events')}>
          <Text style={recent.verTodos}>See all →</Text>
        </Pressable>
      </View>
      {events.map(e => (
        <EventCard key={e.id} event={e} onPress={() => router.push(`/event/${e.id}`)} />
      ))}
    </View>
  );
}

const recent = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
  },
  label: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  verTodos: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
  },
});

// ─── Home Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const events     = useEventsStore(s => s.events);
  const isLoading  = useEventsStore(s => s.isLoading);
  const loadEvents = useEventsStore(s => s.loadEvents);

  useEffect(() => {
    if (events.length === 0 && !isLoading) {
      loadEvents();
    }
  }, []);

  const hasEvents     = events.length > 0;
  const activeEvent   = events.find(e => e.active);
  const recentEvents  = events.filter(e => !e.active);

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
        </View>
      )}

      {/* Variante "com dados" */}
      {hasEvents && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}>
          {activeEvent && (
            <ActiveEventSection event={activeEvent} />
          )}

          {activeEvent && recentEvents.length > 0 && (
            <OrnamentDivider />
          )}

          {recentEvents.length > 0 && (
            <RecentEventsSection events={recentEvents} />
          )}
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
