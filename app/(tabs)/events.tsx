// Events List Screen
// Spec: design/handoff.md § 4
// Print: design/screen-events.png

import { useEffect } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { Event } from '../../types';
import { useEventsStore } from '../../store/useEventsStore';
import { EventCard } from '../../components/EventCard';

// ─── StatsStrip ───────────────────────────────────────────────────────────────

function StatCell({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={strip.cell}>
      <Text style={strip.value}>{value}</Text>
      <Text style={strip.label}>{label}</Text>
    </View>
  );
}

function StatsStrip({ events }: { events: Event[] }) {
  const totalMatches = events.reduce((s, e) => s + e.matches.length, 0);
  const totalWins    = events.reduce((s, e) => s + e.matches.filter(m => m.result === 'W').length, 0);
  const wr = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

  return (
    <View style={strip.container}>
      <StatCell value={events.length} label="Tournaments" />
      <View style={strip.divider} />
      <StatCell value={`${wr}%`} label="Win Rate" />
      <View style={strip.divider} />
      <StatCell value={totalWins} label="Wins" />
    </View>
  );
}

const strip = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    marginBottom: 16,
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
  label: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSec,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
});

// ─── Ornament Divider ─────────────────────────────────────────────────────────

function OrnamentDivider() {
  return (
    <View style={dividerStyle.container}>
      <View style={dividerStyle.line} />
      <Text style={dividerStyle.star}>✦</Text>
      <View style={dividerStyle.line} />
    </View>
  );
}

const dividerStyle = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 16,
    gap: 10,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  star: {
    color: colors.goldDim,
    fontSize: 10,
  },
});

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ label, action, onAction }: {
  label: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={sectionStyle.row}>
      <Text style={sectionStyle.label}>{label}</Text>
      {action && (
        <Pressable onPress={onAction}>
          <Text style={sectionStyle.action}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const sectionStyle = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
  },
  label: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  action: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
  },
});

// ─── Tipos para a FlatList ────────────────────────────────────────────────────

type ListItem =
  | { key: string; type: 'strip' }
  | { key: string; type: 'active-header' }
  | { key: string; type: 'past-header' }
  | { key: string; type: 'divider' }
  | { key: string; type: 'event'; event: Event }
  | { key: string; type: 'footer' };

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const events       = useEventsStore(s => s.events);
  const isLoading    = useEventsStore(s => s.isLoading);
  const loadEvents   = useEventsStore(s => s.loadEvents);
  const activeEvents = events.filter(e => e.active);
  const pastEvents   = events.filter(e => !e.active);

  // Carrega eventos do Supabase quando o écran monta
  useEffect(() => {
    loadEvents();
  }, []);

  const sections: ListItem[] = [
    { key: 'strip', type: 'strip' },
    ...(activeEvents.length > 0 ? [
      { key: 'active-header', type: 'active-header' as const },
      ...activeEvents.map(e => ({ key: e.id, type: 'event' as const, event: e })),
      { key: 'divider', type: 'divider' as const },
    ] : []),
    { key: 'past-header', type: 'past-header' },
    ...pastEvents.map(e => ({ key: e.id, type: 'event' as const, event: e })),
    { key: 'footer', type: 'footer' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.archiveLabel}>Personal Archive</Text>
          <Text style={styles.title}>Events</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.8 }]}
          onPress={() => router.push('/add-event')}
        >
          <Text style={styles.newBtnText}>+ New Event</Text>
        </Pressable>
      </View>

      {isLoading && events.length === 0 && (
        <ActivityIndicator
          color={colors.gold}
          style={{ marginTop: 40 }}
        />
      )}

      <FlatList
        data={sections}
        keyExtractor={item => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 4 }}
        renderItem={({ item }) => {
          switch (item.type) {
            case 'strip':
              return <StatsStrip events={events} />;
            case 'active-header':
              return <SectionHeader label="Active" />;
            case 'past-header':
              return <SectionHeader label="History" action="Filter" />;
            case 'divider':
              return <OrnamentDivider />;
            case 'event':
              return (
                <EventCard
                  event={item.event}
                  onPress={() => router.push(`/event/${item.event.id}`)}
                />
              );
            case 'footer':
              return <View style={{ height: 20 }} />;
            default:
              return null;
          }
        }}
      />
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
    fontSize: 30,
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
});
