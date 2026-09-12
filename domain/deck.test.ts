import { describe, expect, it } from 'vitest';
import {
  canAnalyse,
  groupByType,
  subtypeCounts,
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

describe('subtypeCounts', () => {
  const criaturas = [
    card({ name: 'A', quantity: 4, typeLine: 'Creature — Human Wizard' }),
    card({ name: 'B', quantity: 2, typeLine: 'Legendary Creature — Elf Druid' }),
    card({ name: 'C', quantity: 1, typeLine: 'Creature — Elf' }),
    card({ name: 'Magia', quantity: 4, typeLine: 'Instant' }),
  ];

  it('lê o que está depois do travessão e conta as quantidades', () => {
    const counts = subtypeCounts(criaturas);
    const wizard = counts.find(entry => entry.subtype === 'Wizard');
    const elf = counts.find(entry => entry.subtype === 'Elf');
    expect(wizard?.count).toBe(4);
    // 2 do Elf Druid + 1 do Elf sozinho
    expect(elf?.count).toBe(3);
  });

  it('uma carta de dois subtipos conta nos dois', () => {
    const counts = subtypeCounts([card({ name: 'X', quantity: 1, typeLine: 'Creature — Human Wizard' })]);
    expect(counts.map(entry => entry.subtype).sort()).toEqual(['Human', 'Wizard']);
  });

  it('a percentagem é sobre o total de subtipos, não sobre o número de cartas', () => {
    // Uma carta, dois subtipos: cada um é metade do total contado.
    const counts = subtypeCounts([card({ name: 'X', quantity: 1, typeLine: 'Creature — Human Wizard' })]);
    expect(counts[0].percent).toBe(50);
  });

  it('só conta o tipo pedido', () => {
    // O Instant não tem travessão, mas mesmo que tivesse não entrava na contagem de criaturas.
    const counts = subtypeCounts(criaturas, 'Instant');
    expect(counts).toEqual([]);
  });

  it('junta o excedente em "Other" em vez de cortar a lista', () => {
    const muitos = Array.from({ length: 8 }, (_, index) =>
      card({ name: `C${index}`, quantity: 1, typeLine: `Creature — Sub${index}` }),
    );
    const counts = subtypeCounts(muitos, 'Creature', 5);
    expect(counts).toHaveLength(6);
    expect(counts[5].subtype).toBe('Other');
    expect(counts[5].count).toBe(3);
  });

  it('sem subtipos devolve lista vazia em vez de um "Other" a zero', () => {
    expect(subtypeCounts([card({ name: 'X', quantity: 1, typeLine: 'Creature' })])).toEqual([]);
  });

  it('o sideboard não entra', () => {
    const counts = subtypeCounts([
      card({ name: 'S', quantity: 4, typeLine: 'Creature — Wizard', board: 'side' }),
    ]);
    expect(counts).toEqual([]);
  });
});

describe('groupByType', () => {
  const cards = [
    card({ name: 'Bicho', quantity: 4, typeLine: 'Creature — Elf' }),
    card({ name: 'Magia', quantity: 2, typeLine: 'Instant' }),
    card({ name: 'Terreno', quantity: 20, typeLine: 'Basic Land — Forest' }),
    card({ name: 'Escrita à mão', quantity: 1 }),
  ];

  it('agrupa por tipo e conta as quantidades', () => {
    const groups = groupByType(cards);
    expect(groups.find(g => g.type === 'Creature')?.count).toBe(4);
    expect(groups.find(g => g.type === 'Land')?.count).toBe(20);
  });

  it('ordena pela contagem, do maior para o menor', () => {
    const groups = groupByType(cards).filter(g => g.type !== 'Unknown');
    expect(groups[0].type).toBe('Land');
  });

  it('cartas sem linha de tipo ficam num grupo no fim, em vez de desaparecerem', () => {
    const groups = groupByType(cards);
    expect(groups[groups.length - 1].type).toBe('Unknown');
    expect(groups[groups.length - 1].cards[0].name).toBe('Escrita à mão');
  });

  it('separa main de sideboard', () => {
    const comSide = [...cards, card({ name: 'Side', quantity: 3, typeLine: 'Instant', board: 'side' })];
    expect(groupByType(comSide, 'side')).toHaveLength(1);
    expect(groupByType(comSide, 'side')[0].count).toBe(3);
  });
});
