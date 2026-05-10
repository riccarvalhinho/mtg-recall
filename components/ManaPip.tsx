// ManaPip — símbolo oficial de cor de mana MTG
// SVGs guardados localmente em assets/mana/symbols.ts — funciona offline
//
// Uso:
//   <ManaPip color="G" />             — principal, tamanho padrão
//   <ManaPip color="U" size={20} />   — custom size
//   <ManaPip color="W" isSplash />    — splash: 70% tamanho, 65% opacidade

import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ManaColor } from '../types';
import { MANA_SVG } from '../assets/mana/symbols';

interface ManaPipProps {
  color: ManaColor;
  size?: number;
  isSplash?: boolean;
}

export function ManaPip({ color, size = 16, isSplash = false }: ManaPipProps) {
  const pipSize = isSplash ? Math.round(size * 0.70) : size;

  return (
    <View style={{
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: isSplash ? 0.65 : 1,
    }}>
      <SvgXml
        xml={MANA_SVG[color]}
        width={pipSize}
        height={pipSize}
      />
    </View>
  );
}
