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
import type { CardRarity } from '../types';

/**
 * A cor do símbolo diz a raridade — é assim nas cartas a sério, e por isso não são dois ícones.
 *
 * As cores estão **medidas na app de referência** (a captura do ManaBox), e não inventadas. A
 * lição delas é que a raridade se distingue pela **matiz** e não pelo brilho: branco sem cor,
 * azul-aço, dourado, laranja. A tentativa anterior separava dois cinzentos por claridade — e num
 * símbolo de 12 px, com traços de um pixel, dois cinzentos são o mesmo cinzento.
 *
 * **A comum é branca, não preta.** O fundo da app é `#130F0A`, quase preto: o preto do baralho
 * físico seria um buraco invisível. O branco é o extremo oposto e nunca se confunde com nada — e
 * é também o que a app de referência faz, pela mesma razão.
 */
const RARITY_COLOR: Record<CardRarity, string> = {
  common: '#FFFFFF',
  uncommon: '#7D95A1',
  rare: '#A39676',
  mythic: '#D2703A',
  special: '#B98BD0',
  bonus: '#B98BD0',
};

/**
 * Enquanto não se sabe a raridade.
 *
 * Acontece a cartas gravadas antes de o campo existir, até alguém carregar em *Get card data*.
 * Cinzento apagado e neutro: não reclama raridade nenhuma. Fica a meio caminho entre o fundo e a
 * comum, portanto lê-se como apagado e não como uma raridade a mais. Usar aqui a cor do texto —
 * que nesta paleta é quente — fazia todas as cartas parecerem raras.
 */
const UNKNOWN_RARITY_COLOR = '#5E5E5E';

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
      tintColor={rarity ? RARITY_COLOR[rarity] : UNKNOWN_RARITY_COLOR}
      cachePolicy="memory-disk"
      transition={0}
      onError={() => setFailed(true)}
    />
  );
}
