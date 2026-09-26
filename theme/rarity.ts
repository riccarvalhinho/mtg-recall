// Cores das raridades — MTG Recall
// Fonte de verdade: design/handoff.md § 1.2b
//
// Ficam fora de theme/colors.ts de propósito: a paleta da app é quente e estas têm de ser neutras.
// Viviam dentro de components/SetSymbol.tsx; saíram para aqui para o relatório de evento
// (domain/eventReport.ts), que não pode importar React Native, pintar o símbolo com as mesmas cores.

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
export const RARITY_COLOR: Record<CardRarity, string> = {
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
export const UNKNOWN_RARITY_COLOR = '#5E5E5E';
