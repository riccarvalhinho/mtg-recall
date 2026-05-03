// CardThumbnailPlaceholder — placeholder de imagem de carta MTG
// Spec: design/handoff.md § 2.4
// Fase 3+: substituir por Image com URL do Scryfall

import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

interface CardThumbnailPlaceholderProps {
  width?: number;
  height?: number;
}

export function CardThumbnailPlaceholder({ width = 36, height = 50 }: CardThumbnailPlaceholderProps) {
  return (
    <LinearGradient
      colors={['#2E2618', '#1A1410']}
      style={[styles.container, { width, height, borderRadius: width > 38 ? 5 : 4 }]}
    >
      {/* Frame interior */}
      <View style={styles.innerFrame}>
        {/* Círculo dim central */}
        <View style={styles.circle} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerFrame: {
    flex: 1,
    margin: 4,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: '70%',
  },
  circle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.textDim,
    opacity: 0.5,
  },
});
