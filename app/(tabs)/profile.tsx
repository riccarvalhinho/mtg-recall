// Profile Screen — placeholder
// Fase 2: perfil do utilizador, autenticação, preferências

import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.archiveLabel}>Scholar's Archive</Text>
        <Text style={styles.title}>Profile</Text>
      </View>
      <View style={styles.empty}>
        <Feather name="user" size={40} color={colors.goldDim} style={{ opacity: 0.4 }} />
        <Text style={styles.emptyTitle}>Coming soon</Text>
        <Text style={styles.emptyText}>
          Profile and authentication available in Phase 2.
        </Text>
      </View>
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
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.textPrim,
    lineHeight: 34,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 18,
    color: colors.textSec,
  },
  emptyText: {
    fontFamily: fonts.bodyItal,
    fontSize: 14,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
});
