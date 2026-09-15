// RecordBadge — score W–L–D com win rate por baixo
// Spec: design/handoff.md § 2.3

import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { RecordScore } from './RecordScore';

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
      {/* `auto`: o empate só aparece quando houve algum. Numa lista de eventos, um `– 0` em cada
          linha é ruído — e o empate é raro o suficiente para se reparar nele quando aparece. */}
      <RecordScore wins={wins} losses={losses} draws={draws} size={20} />
      <Text style={styles.wr}>{wr}% WR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
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
