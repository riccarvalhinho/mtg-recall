import { describe, expect, it } from 'vitest';
import {
  appendValueEntry,
  byValueDesc,
  collectionValue,
  priceIndex,
  needsPrinting,
  priceOf,
  pricedIds,
  withPrinting,
} from './collection';
import type { CollectionCard, PriceEntry } from '../types';

function card(partial: Partial<CollectionCard> & { name: string }): CollectionCard {
  return { quantity: 1, ...partial };
}

const prices = priceIndex([
  { scryfallId: 'ragavan', eur: 30, eurFoil: 55 },
  { scryfallId: 'consider', eur: 0.5 },
  { scryfallId: 'sem-preco' },
]);

describe('priceOf', () => {
  it('usa o preço normal por omissão', () => {
    expect(priceOf(card({ name: 'Ragavan', scryfallId: 'ragavan' }), prices)).toBe(30);
  });

  it('usa o preço de foil quando a carta é foil', () => {
    expect(priceOf(card({ name: 'Ragavan', scryfallId: 'ragavan', foil: true }), prices)).toBe(55);
  });

  it('uma carta sem scryfallId não tem preço possível', () => {
    expect(priceOf(card({ name: 'Escrita à mão' }), prices)).toBeNull();
  });

  it('uma impressão que a Scryfall não conhece dá null, não zero', () => {
    expect(priceOf(card({ name: 'X', scryfallId: 'desconhecida' }), prices)).toBeNull();
  });

  it('uma entrada sem preço dá null — ausente não é zero', () => {
    expect(priceOf(card({ name: 'X', scryfallId: 'sem-preco' }), prices)).toBeNull();
  });

  it('foil sem preço de foil não cai para o preço normal', () => {
    // Cair para o normal seria inventar: um foil vale outra coisa, e não sabemos quanto.
    expect(priceOf(card({ name: 'Consider', scryfallId: 'consider', foil: true }), prices)).toBeNull();
  });
});

describe('collectionValue', () => {
  it('multiplica pelo número de cópias', () => {
    const value = collectionValue([card({ name: 'Consider', scryfallId: 'consider', quantity: 4 })], prices);
    expect(value.totalEur).toBe(2);
    expect(value.cards).toBe(4);
    expect(value.priced).toBe(4);
  });

  it('conta as cartas sem preço no total de cartas mas não no valor', () => {
    const value = collectionValue(
      [
        card({ name: 'Ragavan', scryfallId: 'ragavan', quantity: 1 }),
        card({ name: 'Misteriosa', quantity: 3 }),
      ],
      prices,
    );
    expect(value.totalEur).toBe(30);
    expect(value.cards).toBe(4);
    // É isto que deixa a interface dizer "30 € sobre 1 de 4 cartas" em vez de mentir.
    expect(value.priced).toBe(1);
  });

  it('uma colecção vazia vale zero e não rebenta', () => {
    expect(collectionValue([], prices)).toEqual({ totalEur: 0, cards: 0, priced: 0 });
  });

  it('arredonda aos cêntimos — somar floats daria 0.30000000000000004 num ficheiro versionado', () => {
    const cents = priceIndex([{ scryfallId: 'x', eur: 0.1 }]);
    const value = collectionValue([card({ name: 'X', scryfallId: 'x', quantity: 3 })], cents);
    expect(value.totalEur).toBe(0.3);
  });
});

describe('pricedIds', () => {
  it('devolve os ids sem repetições', () => {
    const ids = pricedIds([
      card({ name: 'A', scryfallId: 'x' }),
      card({ name: 'A foil', scryfallId: 'x', foil: true }),
      card({ name: 'B', scryfallId: 'y' }),
    ]);
    expect(ids.sort()).toEqual(['x', 'y']);
  });

  it('ignora cartas sem id, que não têm preço possível', () => {
    expect(pricedIds([card({ name: 'Só nome' })])).toEqual([]);
  });
});

describe('byValueDesc', () => {
  it('ordena pelo valor da pilha e não pelo preço unitário', () => {
    // 20 × 0,50 = 10 € contra 1 × 30 € — a de trinta continua à frente...
    const ordered = byValueDesc(
      [
        card({ name: 'Consider', scryfallId: 'consider', quantity: 20 }),
        card({ name: 'Ragavan', scryfallId: 'ragavan', quantity: 1 }),
      ],
      prices,
    );
    expect(ordered[0].card.name).toBe('Ragavan');
    expect(ordered[0].stackEur).toBe(30);
    expect(ordered[1].stackEur).toBe(10);
  });

  it('põe as cartas sem preço no fim, em vez de as tratar como grátis no topo', () => {
    const ordered = byValueDesc(
      [card({ name: 'Sem preço' }), card({ name: 'Consider', scryfallId: 'consider' })],
      prices,
    );
    expect(ordered[0].card.name).toBe('Consider');
    expect(ordered[1].stackEur).toBeNull();
  });
});

describe('appendValueEntry', () => {
  const entry = (date: string, totalEur: number) => ({ date, totalEur, cards: 1 });

  it('acrescenta ao fim e mantém a ordem cronológica', () => {
    const history = appendValueEntry([entry('2026-01-01', 10)], entry('2026-02-01', 20));
    expect(history.map(item => item.date)).toEqual(['2026-01-01', '2026-02-01']);
  });

  it('correr duas vezes no mesmo dia substitui em vez de duplicar', () => {
    const history = appendValueEntry([entry('2026-01-01', 10)], entry('2026-01-01', 15));
    expect(history).toHaveLength(1);
    expect(history[0].totalEur).toBe(15);
  });

  it('uma entrada fora de ordem é reposta no sítio certo', () => {
    const history = appendValueEntry([entry('2026-03-01', 30)], entry('2026-02-01', 20));
    expect(history.map(item => item.date)).toEqual(['2026-02-01', '2026-03-01']);
  });
});

describe('needsPrinting / withPrinting', () => {
  const manual: CollectionCard = {
    name: 'Lighting Bolt',
    quantity: 3,
    condition: 'NM',
    foil: true,
    language: 'pt',
    notes: 'da caixa do sótão',
  };

  it('uma carta sem scryfallId precisa de impressão', () => {
    expect(needsPrinting(manual)).toBe(true);
  });

  it('uma carta com scryfallId já não precisa', () => {
    expect(needsPrinting({ ...manual, scryfallId: 'abc' })).toBe(false);
  });

  it('ligar guarda o que o utilizador escreveu sobre a cópia que tem', () => {
    const linked = withPrinting(manual, {
      scryfallId: 'abc',
      name: 'Lightning Bolt',
      setCode: 'lea',
      collectorNumber: '161',
    });

    expect(linked).toEqual({
      ...manual,
      // O nome passa a ser o da Scryfall: a gralha ia ficar lá para sempre.
      name: 'Lightning Bolt',
      scryfallId: 'abc',
      setCode: 'lea',
      collectorNumber: '161',
      quantity: 3,
    });
  });

  it('uma impressão sem set não apaga o que já lá estava escrito', () => {
    const linked = withPrinting({ ...manual, setCode: 'm10' }, { scryfallId: 'abc', name: 'Lightning Bolt' });
    expect(linked.setCode).toBe('m10');
  });
});
