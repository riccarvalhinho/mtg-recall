// Event Detail Screen
// Spec: design/handoff.md § 5
// Print: design/screen-event-detail.png

import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { calcEventStats } from '../../types';
import { useEventsStore } from '../../store/useEventsStore';
import { MatchCard } from '../../components/MatchCard';
import { TypeBadge } from '../../components/TypeBadge';
import { ManaPip } from '../../components/ManaPip';
import { CardThumbnailPlaceholder } from '../../components/CardThumbnailPlaceholder';
import { ConfirmModal } from '../../components/ConfirmModal';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── StatsBar ─────────────────────────────────────────────────────────────────

function StatsBar({ wins, losses, draws, points, winRate }: {
  wins: number; losses: number; draws: number; points: number; winRate: number;
}) {
  return (
    <View style={statsBar.container}>
      {/* Record */}
      <View style={statsBar.recordBlock}>
        <Text style={statsBar.record}>{wins} – {losses} – {draws}</Text>
        <Text style={statsBar.recordLabel}>W – L – D</Text>
      </View>

      <View style={statsBar.vDivider} />

      {/* Pontos */}
      <View style={statsBar.cell}>
        <Text style={statsBar.bigValue}>{points}</Text>
        <Text style={statsBar.cellLabel}>Pts</Text>
      </View>

      <View style={statsBar.vDivider} />

      {/* Win Rate */}
      <View style={statsBar.cell}>
        <Text style={statsBar.bigValue}>{winRate}%</Text>
        <Text style={statsBar.cellLabel}>Win Rate</Text>
      </View>
    </View>
  );
}

const statsBar = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  recordBlock: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: colors.gold + '0F',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  record: {
    fontFamily: fonts.displaySemi,
    fontSize: 16,
    color: colors.textSec,
  },
  recordLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  vDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  bigValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.textPrim,
  },
  cellLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSec,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
});

// ─── DeckSection (colapsável) ─────────────────────────────────────────────────

function DeckSection({ deckName, deckColors }: {
  deckName?: string;
  deckColors?: { main: any[]; splash: any[] };
}) {
  const [expanded, setExpanded] = useState(false);

  if (!deckName) return null;

  return (
    <View style={deck.card}>
      <Pressable
        style={deck.header}
        onPress={() => setExpanded(v => !v)}
      >
        <CardThumbnailPlaceholder width={38} height={52} />
        <View style={deck.info}>
          <Text style={deck.label}>Deck</Text>
          <Text style={deck.name}>{deckName}</Text>
          {deckColors && (
            <View style={deck.pips}>
              {deckColors.main.map((c: any) => <ManaPip key={`m-${c}`} color={c} size={14} />)}
              {deckColors.splash.map((c: any) => <ManaPip key={`s-${c}`} color={c} size={14} isSplash />)}
            </View>
          )}
        </View>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-right'}
          size={16}
          color={colors.textDim}
          style={{ opacity: 0.5 }}
        />
      </Pressable>

      {expanded && (
        <View style={deck.expanded}>
          <Text style={deck.expandedText}>
            Detalhes do deck disponíveis na Fase 2 →
          </Text>
        </View>
      )}
    </View>
  );
}

const deck = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontFamily: fonts.bodyItal,
    fontSize: 10,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.textPrim,
  },
  pips: {
    flexDirection: 'row',
    gap: 3,
  },
  expanded: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 14,
  },
  expandedText: {
    fontFamily: fonts.bodyItal,
    fontSize: 13,
    color: colors.textDim,
  },
});

// ─── Botão Adicionar Match ────────────────────────────────────────────────────

function AddMatchButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [addBtn.btn, pressed && { borderColor: colors.goldDim }]}
    >
      <View style={addBtn.circle}>
        <Text style={addBtn.plus}>+</Text>
      </View>
      <Text style={addBtn.text}>Adicionar Match</Text>
    </Pressable>
  );
}

const addBtn = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 10,
    gap: 8,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold + '22',
    borderWidth: 1,
    borderColor: colors.gold + '66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    color: colors.gold,
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSec,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEventsStore(s => s.events.find(e => e.id === id));

  if (!event) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={{ color: colors.textSec, padding: 20 }}>Evento não encontrado.</Text>
      </SafeAreaView>
    );
  }

  const deleteEvent = useEventsStore(s => s.deleteEvent);
  const deleteMatch = useEventsStore(s => s.deleteMatch);
  const stats = calcEventStats(event);

  // Estado dos modais de confirmação
  const [deleteEventModal, setDeleteEventModal] = useState(false);
  const [deleteMatchModal, setDeleteMatchModal] = useState<{ id: string; opponent: string } | null>(null);

  function goToMatchRegistration() {
    router.push({
      pathname: '/match-registration',
      params: {
        eventId: event!.id,
        round: String(event!.matches.length + 1),
        eventName: event!.name,
      },
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* NavBar */}
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color={colors.textPrim} />
        </Pressable>
        <Text style={styles.breadcrumb}>Eventos</Text>
        <Pressable style={styles.deleteBtn} onPress={() => setDeleteEventModal(true)}>
          <Feather name="trash-2" size={16} color={colors.loss} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Event Header */}
        <View style={styles.eventHeader}>
          <View style={styles.badges}>
            <TypeBadge type={event.type} />
            {event.name.includes('—') && (
              <View style={styles.setBadge}>
                <Text style={styles.setBadgeText}>
                  {event.name.split('—')[1]?.trim().toLowerCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.eventName}>{event.name}</Text>
          <View style={styles.eventMeta}>
            <View style={styles.metaRow}>
              <Feather name="calendar" size={12} color={colors.textDim} />
              <Text style={styles.metaText}>{formatDate(event.date)}</Text>
            </View>
            {event.location && (
              <View style={styles.metaRow}>
                <Feather name="map-pin" size={12} color={colors.textDim} />
                <Text style={styles.metaText}>{event.location}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats Bar */}
        <StatsBar
          wins={stats.wins}
          losses={stats.losses}
          draws={stats.draws}
          points={stats.points}
          winRate={stats.winRate}
        />

        {/* Deck Section */}
        <DeckSection
          deckName={event.deckName}
          deckColors={event.deckColors}
        />

        {/* Matches */}
        <View style={styles.matchesHeader}>
          <Text style={styles.matchesTitle}>Matches</Text>
          <Text style={styles.matchesCount}>{event.matches.length}</Text>
        </View>

        {event.matches.map(match => (
          <MatchCard
            key={match.id}
            match={match}
            onLongPress={() => setDeleteMatchModal({ id: match.id, opponent: match.opponent })}
          />
        ))}

        {/* Botão adicionar match */}
        {event.active && (
          <AddMatchButton onPress={goToMatchRegistration} />
        )}

        <View style={{ height: 16 }} />
      </ScrollView>
      {/* Modal: apagar evento */}
      <ConfirmModal
        visible={deleteEventModal}
        title="Apagar evento"
        message={`Tens a certeza que queres apagar "${event.name}"?\n\nTodos os matches serão apagados.`}
        confirmLabel="Apagar"
        confirmDestructive
        onConfirm={async () => {
          setDeleteEventModal(false);
          const ok = await deleteEvent(event.id);
          if (ok) router.back();
        }}
        onCancel={() => setDeleteEventModal(false)}
      />

      {/* Modal: apagar match */}
      <ConfirmModal
        visible={deleteMatchModal !== null}
        title="Apagar match"
        message={`Apagar o match contra ${deleteMatchModal?.opponent}?`}
        confirmLabel="Apagar"
        confirmDestructive
        onConfirm={() => {
          if (deleteMatchModal) deleteMatch(event.id, deleteMatchModal.id);
          setDeleteMatchModal(null);
        }}
        onCancel={() => setDeleteMatchModal(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  deleteBtn: {
    marginLeft: 'auto',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.lossBg,
    borderWidth: 1,
    borderColor: colors.lossBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breadcrumb: {
    fontFamily: fonts.bodyItal,
    fontSize: 14,
    color: colors.textDim,
  },
  eventHeader: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
    gap: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  setBadge: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  setBadgeText: {
    fontFamily: fonts.bodyItal,
    fontSize: 10,
    color: colors.textDim,
  },
  eventName: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.textPrim,
    lineHeight: 28,
  },
  eventMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
  },
  matchesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
  },
  matchesTitle: {
    fontFamily: fonts.bodyItal,
    fontSize: 11,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  matchesCount: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textDim,
  },
});
