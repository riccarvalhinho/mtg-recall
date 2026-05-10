// MatchCard — card de resultado de match individual
// Spec: design/handoff.md § 5.4
// Usado em: Event Detail

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { Match, MatchResult } from '../types';
import { ManaPip } from './ManaPip';

// Configuração visual por resultado
const RESULT_STYLES: Record<MatchResult, { bg: string; border: string; text: string; label: string }> = {
  W: { bg: colors.winBg,  border: colors.winBorder,  text: colors.win,  label: 'Win'  },
  L: { bg: colors.lossBg, border: colors.lossBorder, text: colors.loss, label: 'Loss' },
  D: { bg: colors.drawBg, border: colors.drawBorder, text: colors.draw, label: 'Draw' },
};

interface MatchCardProps {
  match: Match;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function MatchCard({ match, onPress, onLongPress }: MatchCardProps) {
  const rs = RESULT_STYLES[match.result];

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Pill de resultado */}
      <View style={[styles.resultPill, { backgroundColor: rs.bg, borderColor: rs.border }]}>
        <Text style={[styles.resultLetter, { color: rs.text }]}>
          {match.result}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.round}>Round {match.round}</Text>
        <Text style={styles.opponent} numberOfLines={1}>
          {match.opponent}
        </Text>
      </View>

      {/* Cores do adversário */}
      <View style={styles.manaGroup}>
        {match.opponentColors.main.map(c => (
          <ManaPip key={`main-${c}`} color={c} size={17} />
        ))}
        {match.opponentColors.splash.map(c => (
          <ManaPip key={`splash-${c}`} color={c} size={17} isSplash />
        ))}
      </View>

      <Feather name="chevron-right" size={13} color={colors.textDim} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    paddingHorizontal: 14,
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 6,
  },
  cardPressed: {
    backgroundColor: colors.bgCardHov,
  },
  resultPill: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultLetter: {
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 22,
    includeFontPadding: false,
  },
  info: {
    flex: 1,
    gap: 1,
  },
  round: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  opponent: {
    fontFamily: fonts.displayMed,
    fontSize: 15,
    color: colors.textPrim,
  },
  manaGroup: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  chevron: {
    opacity: 0.25,
  },
});
