// EventCard — card de evento com record, mana pips, chevron
// Spec: design/handoff.md § 4.3
// Usado em: Events List, Home (secção eventos recentes)

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { Event, calcEventStats } from '../types';
import { ManaPip } from './ManaPip';
import { TypeBadge } from './TypeBadge';
import { RecordBadge } from './RecordBadge';
import { CardThumbnailPlaceholder } from './CardThumbnailPlaceholder';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

interface EventCardProps {
  event: Event;
  onPress: () => void;
  showThumbnail?: boolean;
}

export function EventCard({ event, onPress, showThumbnail = true }: EventCardProps) {
  const stats = calcEventStats(event);
  const deckColors = event.deckColors;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        event.active && styles.cardActive,
        pressed && styles.cardPressed,
      ]}
    >
      {/* Barra accent (só em eventos activos) */}
      {event.active && (
        <LinearGradient
          colors={[colors.gold, colors.goldDim]}
          style={styles.accentBar}
        />
      )}

      <View style={[styles.row, event.active && styles.rowActive]}>
        {/* Thumbnail */}
        {showThumbnail && (
          <CardThumbnailPlaceholder width={36} height={50} />
        )}

        {/* Info */}
        <View style={styles.info}>
          {/* Badges */}
          <View style={styles.badges}>
            {event.active && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            )}
            <TypeBadge type={event.type} />
          </View>

          {/* Nome do evento */}
          <Text style={styles.name} numberOfLines={1}>
            {event.name}
          </Text>

          {/* Mana pips + data */}
          <View style={styles.meta}>
            {deckColors && (
              <>
                {deckColors.main.map(c => (
                  <ManaPip key={`main-${c}`} color={c} size={14} />
                ))}
                {deckColors.splash.map(c => (
                  <ManaPip key={`splash-${c}`} color={c} size={14} isSplash />
                ))}
                <Text style={styles.metaDot}>·</Text>
              </>
            )}
            <Feather name="calendar" size={10} color={colors.textDim} />
            <Text style={styles.date}>{formatDate(event.date)}</Text>
          </View>
        </View>

        {/* Record + chevron */}
        <View style={styles.right}>
          <RecordBadge wins={stats.wins} losses={stats.losses} draws={stats.draws} />
          <Feather name="chevron-right" size={14} color={colors.textDim} style={styles.chevron} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  cardActive: {
    borderColor: colors.gold + '88',
  },
  cardPressed: {
    backgroundColor: colors.bgCardHov,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
  },
  rowActive: {
    paddingLeft: 20, // espaço para a accent bar
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
  activeBadge: {
    backgroundColor: colors.gold + '22',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold + '55',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activeBadgeText: {
    fontFamily: fonts.bodyItal,
    fontSize: 9,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  metaDot: {
    color: colors.textDim,
    fontSize: 10,
  },
  date: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textDim,
    marginLeft: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevron: {
    opacity: 0.4,
  },
});
