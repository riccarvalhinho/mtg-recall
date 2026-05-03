// ManaPip — símbolo oficial de cor de mana MTG
// Fonte: Scryfall CDN (https://svgs.scryfall.io/card-symbols/)
// Fase produção: substituir URIs remotas por assets locais em assets/mana/
//
// Uso:
//   <ManaPip color="G" />             — principal, tamanho padrão
//   <ManaPip color="U" size={20} />   — custom size
//   <ManaPip color="W" isSplash />    — splash: 70% tamanho, 65% opacidade

import { View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { ManaColor } from '../types';

const MANA_URLS: Record<ManaColor, string> = {
  W: 'https://svgs.scryfall.io/card-symbols/W.svg',
  U: 'https://svgs.scryfall.io/card-symbols/U.svg',
  B: 'https://svgs.scryfall.io/card-symbols/B.svg',
  R: 'https://svgs.scryfall.io/card-symbols/R.svg',
  G: 'https://svgs.scryfall.io/card-symbols/G.svg',
};

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
      <SvgUri
        width={pipSize}
        height={pipSize}
        uri={MANA_URLS[color]}
      />
    </View>
  );
}
