// ManaPip — símbolo de cor de mana MTG
// Fonte: design/handoff.md § 1.3 e § 2 (componentes partilhados)
//
// Uso:
//   <ManaPip color="G" />                     — principal, tamanho padrão
//   <ManaPip color="U" size={20} />            — custom size
//   <ManaPip color="W" isSplash />             — splash: 70% tamanho, 70% opacidade, sem letra

import { View, Text, StyleSheet } from 'react-native';
import { manaColors, ManaColor } from '../theme/mana';
import { fonts } from '../theme/typography';

interface ManaPipProps {
  color: ManaColor;
  size?: number;
  isSplash?: boolean; // 70% size, 70% opacity, sem letra
}

export function ManaPip({ color, size = 16, isSplash = false }: ManaPipProps) {
  const m = manaColors[color];
  const pipSize = isSplash ? Math.round(size * 0.70) : size;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: pipSize,
          height: pipSize,
          borderRadius: pipSize / 2,
          backgroundColor: m.bgSel,
          borderWidth: 1.5,
          borderColor: isSplash ? m.border : m.borderSel,
          opacity: isSplash ? 0.70 : 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!isSplash && (
          <Text
            style={{
              fontFamily: fonts.bodyMed,
              fontSize: pipSize * 0.50,
              color: m.text,
              lineHeight: pipSize * 0.65,
              includeFontPadding: false,
            }}
          >
            {color}
          </Text>
        )}
      </View>
    </View>
  );
}
