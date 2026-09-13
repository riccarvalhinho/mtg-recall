// SetSymbol — o ícone do set ao lado do nome da carta
//
// O URL é **construído** a partir do código do set, e não guardado: a Scryfall serve os símbolos em
// `svgs.scryfall.io/sets/<código>.svg`, um ficheiro por set. Guardar o URL em cada carta seria
// repetir a mesma string dezenas de vezes dentro do ficheiro do deck para não ganhar nada.
//
// Falhar é silencioso e é suposto: um código que a Scryfall não conheça, ou nenhuma rede à primeira
// vez, dão uma linha sem ícone — que é exactamente como estava antes de isto existir. O ícone é
// enfeite informativo, não informação que falte.

import { useState } from 'react';
import { Image } from 'expo-image';
import { colors } from '../theme/colors';

interface SetSymbolProps {
  /** Código do set, como vem da Scryfall (minúsculas). */
  setCode?: string;
  size?: number;
}

export function SetSymbol({ setCode, size = 13 }: SetSymbolProps) {
  const [failed, setFailed] = useState(false);

  const code = setCode?.trim().toLowerCase();
  if (!code || failed) return null;

  return (
    <Image
      source={{ uri: `https://svgs.scryfall.io/sets/${code}.svg` }}
      style={{ width: size, height: size }}
      contentFit="contain"
      // Os símbolos vêm pretos, e o fundo da app é quase preto. Sem isto ficavam invisíveis.
      tintColor={colors.textSec}
      cachePolicy="memory-disk"
      transition={0}
      onError={() => setFailed(true)}
    />
  );
}
