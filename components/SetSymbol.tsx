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
import type { CardRarity } from '../types';

/**
 * A cor do símbolo diz a raridade — é assim nas cartas a sério, e por isso não são dois ícones.
 *
 * Os tons são os do baralho físico, puxados para o claro o suficiente para se verem sobre o fundo
 * quase preto da app: prateado, dourado, o laranja das míticas. As comuns ficam com o cinzento do
 * texto secundário, que é o equivalente do preto impresso.
 */
const RARITY_COLOR: Record<CardRarity, string> = {
  common: colors.textSec,
  uncommon: '#C3CBD2',
  rare: '#D8B65F',
  mythic: '#D2703A',
  special: '#B98BD0',
  bonus: '#B98BD0',
};

interface SetSymbolProps {
  /** Código do set, como vem da Scryfall (minúsculas). */
  setCode?: string;
  /** Raridade da impressão. Sem ela o símbolo fica com a cor do texto secundário. */
  rarity?: CardRarity;
  size?: number;
}

export function SetSymbol({ setCode, rarity, size = 13 }: SetSymbolProps) {
  const [failed, setFailed] = useState(false);

  const code = setCode?.trim().toLowerCase();
  if (!code || failed) return null;

  return (
    <Image
      source={{ uri: `https://svgs.scryfall.io/sets/${code}.svg` }}
      style={{ width: size, height: size }}
      contentFit="contain"
      // Os símbolos vêm pretos, e o fundo da app é quase preto. Sem isto ficavam invisíveis — e a
      // cor não é só para os ver: é ela que diz a raridade.
      tintColor={rarity ? RARITY_COLOR[rarity] : colors.textSec}
      cachePolicy="memory-disk"
      transition={0}
      onError={() => setFailed(true)}
    />
  );
}
