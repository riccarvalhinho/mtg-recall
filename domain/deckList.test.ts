import { describe, expect, it } from 'vitest';
import type { DeckCard } from '../types';
import {
  addCard,
  cardKey,
  cardsForBoard,
  changeQuantity,
  clampQuantity,
  normalizeDeckCards,
  parseQuantity,
  removeCard,
  setBoard,
  setQuantity,
  toStoredCards,
} from './deckList.ts';

function card(name: string, quantity = 1, board?: 'main' | 'side'): DeckCard {
  return { name, quantity, board: board === 'side' ? 'side' : undefined };
}

/** A mesma chave que o `tools/validate-data.mts` usa para apanhar repetições. */
describe('cardKey', () => {
  it('board mais nome em minúsculas, como o validador', () => {
    expect(cardKey(card('Lightning Bolt'))).toBe('main:lightning bolt');
    expect(cardKey(card('  lightning bolt ', 1, 'side'))).toBe('side:lightning bolt');
  });

  it('a mesma carta no main e no sideboard são linhas diferentes', () => {
    expect(cardKey(card('Negate'))).not.toBe(cardKey(card('Negate', 1, 'side')));
  });
});

describe('addCard', () => {
  it('junta as quantidades em vez de criar uma segunda linha', () => {
    // Duas linhas da mesma carta na mesma board são chumbadas pelo `npm run validate`, e só depois
    // do commit já ter saído do telemóvel.
    const list = addCard(addCard([], card('Lightning Bolt', 2)), card('lightning bolt', 2));

    expect(list).toHaveLength(1);
    expect(list[0].quantity).toBe(4);
    expect(list[0].name).toBe('Lightning Bolt');
  });

  it('a mesma carta no sideboard é uma linha à parte', () => {
    const list = addCard(addCard([], card('Negate', 1)), card('Negate', 2, 'side'));

    expect(list).toHaveLength(2);
    expect(cardsForBoard(list, 'side')[0].quantity).toBe(2);
  });

  it('não passa das 99 que o schema aceita', () => {
    const list = addCard(addCard([], card('Persistent Petitioners', 90)), card('Persistent Petitioners', 30));

    expect(list[0].quantity).toBe(99);
  });

  it('uma carta escrita à mão ganha os campos da Scryfall quando volta a ser acrescentada', () => {
    // Sem isto a linha ficava para sempre sem cmc nem typeLine, e portanto fora da análise.
    const manual: DeckCard = { name: 'Lightning Bolt', quantity: 1 };
    const fromScryfall: DeckCard = {
      name: 'Lightning Bolt', quantity: 1, scryfallId: 'abc', manaCost: '{R}', cmc: 1,
      typeLine: 'Instant', colors: ['R'],
    };

    const [merged] = addCard([manual], fromScryfall);

    expect(merged.quantity).toBe(2);
    expect(merged.cmc).toBe(1);
    expect(merged.typeLine).toBe('Instant');
    expect(merged.scryfallId).toBe('abc');
  });

  it('não mexe na lista que recebeu', () => {
    const original = [card('Island', 4)];
    addCard(original, card('Island', 4));

    expect(original[0].quantity).toBe(4);
  });
});

describe('quantidades', () => {
  it('mantém-se entre 1 e 99', () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-3)).toBe(1);
    expect(clampQuantity(140)).toBe(99);
    expect(clampQuantity(2.7)).toBe(2);
    expect(clampQuantity(Number.NaN)).toBe(1);
  });

  it('lê o que for escrito no campo, sem nunca ficar inválida', () => {
    expect(parseQuantity('4')).toBe(4);
    expect(parseQuantity('')).toBe(1);
    expect(parseQuantity('abc')).toBe(1);
    expect(parseQuantity('4x')).toBe(4);
    expect(parseQuantity('300')).toBe(99);
  });

  it('o + e o − mexem na linha certa', () => {
    const list = [card('Island', 4), card('Mountain', 4)];

    expect(changeQuantity(list, 'main:island', 1)[0].quantity).toBe(5);
    expect(changeQuantity(list, 'main:island', -1)[0].quantity).toBe(3);
    expect(changeQuantity(list, 'main:island', -1)[1].quantity).toBe(4);
  });

  it('descer abaixo de 1 remove a linha', () => {
    // Uma linha com zero cópias nem sequer passa no schema, e procurar um caixote do lixo num
    // telemóvel é pior do que carregar no − até ela desaparecer.
    expect(changeQuantity([card('Island', 1)], 'main:island', -1)).toEqual([]);
    expect(setQuantity([card('Island', 4)], 'main:island', 0)).toEqual([]);
  });

  it('uma chave que não existe não muda nada', () => {
    const list = [card('Island', 4)];
    expect(changeQuantity(list, 'main:forest', 1)).toEqual(list);
  });
});

describe('setBoard', () => {
  it('passa uma carta para o sideboard', () => {
    const list = setBoard([card('Negate', 2)], 'main:negate', 'side');

    expect(cardsForBoard(list, 'main')).toEqual([]);
    expect(cardsForBoard(list, 'side')[0]).toMatchObject({ name: 'Negate', quantity: 2, board: 'side' });
  });

  it('junta-se à carta que já lá estava do outro lado', () => {
    // Duas linhas de Negate no sideboard seriam a repetição que o validador chumba.
    const list = setBoard([card('Negate', 2), card('Negate', 1, 'side')], 'main:negate', 'side');

    expect(list).toHaveLength(1);
    expect(list[0].quantity).toBe(3);
  });

  it('mandar para a board onde já está não muda nada', () => {
    const list = [card('Negate', 2)];
    expect(setBoard(list, 'main:negate', 'main')).toBe(list);
  });

  it('volta do sideboard para o main sem deixar o campo board para trás', () => {
    const list = setBoard([card('Negate', 2, 'side')], 'side:negate', 'main');

    expect(list[0].board).toBeUndefined();
  });
});

describe('removeCard', () => {
  it('tira só a linha pedida', () => {
    const list = removeCard([card('Island', 4), card('Island', 2, 'side')], 'main:island');

    expect(list).toHaveLength(1);
    expect(list[0].board).toBe('side');
  });
});

describe('normalizeDeckCards', () => {
  it('põe em condições uma lista escrita à mão no GitHub', () => {
    // Um ficheiro editado à mão pode trazer a mesma carta duas vezes ou uma quantidade a 0; gravar
    // por cima sem olhar era passar o problema para o CI.
    const list = normalizeDeckCards([
      { name: 'Lightning Bolt', quantity: 2 },
      { name: 'lightning bolt', quantity: 2 },
      { name: 'Island', quantity: 0 },
      { name: '   ', quantity: 3 },
    ]);

    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ name: 'Lightning Bolt', quantity: 4 });
    expect(list[1]).toMatchObject({ name: 'Island', quantity: 1 });
  });

  it('uma lista ausente é uma lista vazia', () => {
    expect(normalizeDeckCards(undefined)).toEqual([]);
  });
});

describe('toStoredCards', () => {
  it('uma lista vazia não vai para o ficheiro', () => {
    // `cards` é opcional no schema, e um array vazio era uma linha a mais em cada deck sem cartas.
    expect(toStoredCards([])).toBeUndefined();
    expect(toStoredCards([card('Island', 4)])).toHaveLength(1);
  });
});
