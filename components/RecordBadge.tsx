// RecordBadge — score W–L com win rate por baixo
// Spec: design/handoff.md § 2.3

import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

interface RecordBadgeProps {
  wins: number;
  losses: number;
  draws?: number;
}

export function RecordBadge({ wins, losses, draws = 0 }: RecordBadgeProps) {
  const total = wins + losses + draws;
  const wr = total > 0 ? Math.round((wins / total) * 100) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.record}>
        <Text style={styles.wins}>{wins}</Text>
        <Text style={styles.separator}> – </Text>
        <Text style={styles.losses}>{losses}</Text>
      </View>
      <Text style={styles.wr}>{wr}% WR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  record: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  wins: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.win,
  },
  separator: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textDim,
  },
  losses: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.loss,
  },
  wr: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSec,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 1,
  },
});
