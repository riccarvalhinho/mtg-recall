import { describe, expect, it } from 'vitest';
import {
  canAnalyse,
  cardCount,
  colorDistribution,
  deckPerformance,
  isLand,
  manaCurve,
  primaryType,
  rankDecks,
  typeCounts,
} from './deck';
import type { Deck, DeckCard, Event, Match } from '../types';

// ─── Auxiliares ──────────────────────────────────────────────────────────────

function match(result: 'W' | 'L' | 'D', round = 1): Match {
  return {
    round,
    opponentId: 'x',
    opponent: 'X',
    opponentColors: { main: [], splash: [] },
    result,
  };
}

function event(id: string, deckId: string | undefined, ...results: ('W' | 'L' | 'D')[]): Event {
  return {
    id,
    name: id,
    type: 'Modern',
    date: '2026-01-01',
    status: 'completed',
    deckId,
    matches: results.map((result, index) => match(result, index + 1)),
  };
}

function card(partial: Partial<DeckCard> & { name: string }): DeckCard {
  return { quantity: 1, ...partial };
}

function deck(id: string, cards?: DeckCard[]): Deck {
  return { id, name: id, colors: { main: [], splash: [] }, cards };
}

// ─── Desempenho ──────────────────────────────────────────────────────────────

describe('deckPerformance', () => {
  it('soma os matches de todos os eventos com aquele deck', () => {
    const events = [
      event('e1', 'izzet', 'W', 'W', 'L'),
      event('e2', 'izzet', 'W', 'D'),
      event('e3', 'outro', 'L', 'L'),
    ];

    const stats = deckPerformance('izzet', events);
    expect(stats.events).toBe(2);
    expect(stats.wins).toBe(3);
    expect(stats.losses).toBe(1);
    expect(stats.draws).toBe(1);
    expect(stats.winRate).toBe(60); // 3 de 5
  });

  it('um deck sem eventos dá zeros e não rebenta', () => {
    expect(deckPerformance('nada', [])).toMatchObject({ events: 0, winRate: 0 });
  });

  it('ignora eventos sem deckId — são os anteriores à Fase 2', () => {
    const stats = deckPerformance('izzet', [event('legado', undefined, 'W', 'W')]);
    expect(stats.wins).toBe(0);
  });
});

describe('rankDecks', () => {
  it('ordena pelo win rate, do melhor para o pior', () => {
    const events = [
      event('e1', 'bom', 'W', 'W', 'W', 'L'),
      event('e2', 'mau', 'L', 'L', 'W'),
    ];
    const ranked = rankDecks([deck('mau'), deck('bom')], events);
    expect(ranked.map(entry => entry.deckId)).toEqual(['bom', 'mau']);
  });

  it('decks ainda não jogados vão para o fim, mas não desaparecem', () => {
    const events = [event('e1', 'jogado', 'L', 'L')];
    const ranked = rankDecks([deck('novo'), deck('jogado')], events);
    expect(ranked.map(entry => entry.deckId)).toEqual(['jogado', 'novo']);
    expect(ranked).toHaveLength(2);
  });

  it('com win rates iguais, quem jogou mais fica à frente', () => {
    const events = [
      event('e1', 'muito', 'W', 'L', 'W', 'L'),
      event('e2', 'pouco', 'W', 'L'),
    ];
    const ranked = rankDecks([deck('pouco'), deck('muito')], events);
    expect(ranked[0].deckId).toBe('muito');
  });
});

// ─── Análise da lista ────────────────────────────────────────────────────────

describe('cardCount', () => {
  const cards = [
    card({ name: 'A', quantity: 4 }),
    card({ name: 'B', quantity: 2, board: 'side' }),
  ];

  it('conta quantidades, não linhas', () => {
    expect(cardCount(cards)).toBe(6);
  });

  it('sabe separar main de side', () => {
    expect(cardCount(cards, 'main')).toBe(4);
    expect(cardCount(cards, 'side')).toBe(2);
  });

  it('sem cartas dá zero', () => {
    expect(cardCount(undefined)).toBe(0);
  });
});

describe('isLand', () => {
  it('reconhece terrenos pela linha de tipo', () => {
    expect(isLand(card({ name: 'Island', typeLine: 'Basic Land — Island' }))).toBe(true);
    expect(isLand(card({ name: 'Consider', typeLine: 'Instant' }))).toBe(false);
  });
});

describe('manaCurve', () => {
  it('junta por valor de mana e conta as quantidades', () => {
    const curve = manaCurve([
      card({ name: 'A', quantity: 4, cmc: 1, typeLine: 'Instant' }),
      card({ name: 'B', quantity: 2, cmc: 1, typeLine: 'Creature' }),
      card({ name: 'C', quantity: 3, cmc: 3, typeLine: 'Creature' }),
    ]);
    expect(curve.find(bucket => bucket.cmc === 1)?.count).toBe(6);
    expect(curve.find(bucket => bucket.cmc === 2)?.count).toBe(0);
    expect(curve.find(bucket => bucket.cmc === 3)?.count).toBe(3);
  });

  it('deixa os terrenos de fora — encheriam a barra do zero', () => {
    const curve = manaCurve([
      card({ name: 'Island', quantity: 24, cmc: 0, typeLine: 'Basic Land — Island' }),
      card({ name: 'Consider', quantity: 4, cmc: 1, typeLine: 'Instant' }),
    ]);
    expect(curve.find(bucket => bucket.cmc === 0)?.count).toBe(0);
  });

  it('deixa de fora as cartas sem cmc em vez de as contar como grátis', () => {
    expect(manaCurve([card({ name: 'Escrita à mão', quantity: 4 })])).toEqual([]);
  });

  it('o sideboard não entra na curva', () => {
    const curve = manaCurve([
      card({ name: 'Main', quantity: 1, cmc: 2, typeLine: 'Instant' }),
      card({ name: 'Side', quantity: 3, cmc: 2, typeLine: 'Instant', board: 'side' }),
    ]);
    expect(curve.find(bucket => bucket.cmc === 2)?.count).toBe(1);
  });

  it('tudo acima de 7 cai no mesmo balde', () => {
    const curve = manaCurve([
      card({ name: 'Emrakul', quantity: 1, cmc: 15, typeLine: 'Creature' }),
      card({ name: 'Ulamog', quantity: 2, cmc: 8, typeLine: 'Creature' }),
    ]);
    const top = curve[curve.length - 1];
    expect(top.isTop).toBe(true);
    expect(top.cmc).toBe(7);
    expect(top.count).toBe(3);
  });
});

describe('colorDistribution', () => {
  it('conta cada cor, e uma carta de duas cores conta nas duas', () => {
    const slices = colorDistribution([
      card({ name: 'Mono', quantity: 4, colors: ['U'] }),
      card({ name: 'Ouro', quantity: 2, colors: ['U', 'R'] }),
    ]);
    expect(slices).toEqual([
      { color: 'U', count: 6 },
      { color: 'R', count: 2 },
    ]);
  });

  it('cores sem cartas não aparecem', () => {
    expect(colorDistribution([card({ name: 'X', colors: ['G'] })])).toHaveLength(1);
  });

  it('cartas incolores não contam para cor nenhuma', () => {
    expect(colorDistribution([card({ name: 'Sol Ring', quantity: 1 })])).toEqual([]);
  });
});

describe('primaryType', () => {
  it('um artifact creature conta como criatura', () => {
    expect(primaryType(card({ name: 'X', typeLine: 'Artifact Creature — Golem' }))).toBe('Creature');
  });

  it('ignora supertipos', () => {
    expect(primaryType(card({ name: 'X', typeLine: 'Legendary Creature — Monkey' }))).toBe('Creature');
  });

  it('ignora os subtipos depois do travessão', () => {
    // "Island" é subtipo aqui, não devia fazer disto um Land por causa do lado direito.
    expect(primaryType(card({ name: 'X', typeLine: 'Enchantment — Aura' }))).toBe('Enchantment');
  });

  it('aceita um hífen no lugar do travessão, para ficheiros escritos à mão', () => {
    expect(primaryType(card({ name: 'X', typeLine: 'Basic Land - Island' }))).toBe('Land');
  });

  it('sem linha de tipo não inventa', () => {
    expect(primaryType(card({ name: 'X' }))).toBeNull();
  });
});

describe('typeCounts', () => {
  it('conta por tipo, do mais comum para o menos, e inclui terrenos', () => {
    const counts = typeCounts([
      card({ name: 'Island', quantity: 24, typeLine: 'Basic Land — Island' }),
      card({ name: 'Bicho', quantity: 12, typeLine: 'Creature — Elf' }),
      card({ name: 'Magia', quantity: 4, typeLine: 'Instant' }),
    ]);
    expect(counts).toEqual([
      { type: 'Land', count: 24 },
      { type: 'Creature', count: 12 },
      { type: 'Instant', count: 4 },
    ]);
  });
});

describe('canAnalyse', () => {
  it('um deck sem cartas não dá análise nenhuma', () => {
    expect(canAnalyse(deck('vazio'))).toBe(false);
  });

  it('um deck com nomes escritos à mão e mais nada também não', () => {
    expect(canAnalyse(deck('mao', [card({ name: 'Qualquer coisa', quantity: 4 })]))).toBe(false);
  });

  it('basta ter linha de tipo para valer a pena', () => {
    expect(canAnalyse(deck('ok', [card({ name: 'X', quantity: 4, typeLine: 'Instant' })]))).toBe(true);
  });
});
