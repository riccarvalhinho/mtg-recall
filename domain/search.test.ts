import { describe, expect, it } from 'vitest';
import { matchesQuery, searchEvents } from './search.ts';
import type { Event, Match } from '../types';

function match(opponent: string): Match {
  return {
    round: 1,
    opponentId: opponent.toLowerCase().replace(/\s+/g, '-'),
    opponent,
    opponentColors: { main: [], splash: [] },
    result: 'W',
  };
}

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: '2026-04-12-fnm-sealed-aetherdrift',
    name: 'FNM Sealed — Aetherdrift',
    type: 'Sealed',
    date: '2026-04-12',
    location: 'Bazazz, Lisboa',
    status: 'completed',
    matches: [match('João Ferreira')],
    ...overrides,
  };
}

describe('matchesQuery', () => {
  it('encontra pelo nome do evento', () => {
    expect(matchesQuery(event(), 'aetherdrift')).toBe(true);
  });

  it('encontra pelo local', () => {
    expect(matchesQuery(event(), 'bazazz')).toBe(true);
  });

  it('encontra pelo adversário', () => {
    // É assim que alguém se lembra de um torneio antigo: "aquele em que joguei contra o João".
    expect(matchesQuery(event(), 'ferreira')).toBe(true);
  });

  it('ignora acentos e maiúsculas dos dois lados', () => {
    expect(matchesQuery(event(), 'joao')).toBe(true);
    expect(matchesQuery(event(), 'JOÃO')).toBe(true);
  });

  it('exige todos os termos, não algum', () => {
    // Com poucas dezenas de eventos, um OR devolvia quase tudo e a procura não servia de nada.
    expect(matchesQuery(event(), 'sealed joao')).toBe(true);
    expect(matchesQuery(event(), 'sealed pedro')).toBe(false);
  });

  it('uma procura vazia corresponde a tudo', () => {
    expect(matchesQuery(event(), '')).toBe(true);
    expect(matchesQuery(event(), '   ')).toBe(true);
  });

  it('não rebenta num evento sem local nem matches', () => {
    const empty = event({ location: undefined, matches: [] });
    expect(matchesQuery(empty, 'aetherdrift')).toBe(true);
    expect(matchesQuery(empty, 'bazazz')).toBe(false);
  });
});

describe('searchEvents', () => {
  const events = [
    event(),
    event({
      id: '2026-05-03-modern-rcq',
      name: 'Modern RCQ',
      type: 'Modern',
      location: 'Porto',
      matches: [match('Pedro Silva')],
    }),
  ];

  it('devolve tudo quando não há procura, pela mesma ordem', () => {
    expect(searchEvents(events, '  ').map(e => e.id)).toEqual(events.map(e => e.id));
  });

  it('filtra e mantém a ordem de entrada', () => {
    expect(searchEvents(events, 'pedro').map(e => e.id)).toEqual(['2026-05-03-modern-rcq']);
  });

  it('devolve lista vazia quando nada corresponde', () => {
    expect(searchEvents(events, 'lisboa porto')).toEqual([]);
  });
});
