import { describe, it, expect } from 'vitest';
import {
  TIERS,
  bestFinish,
  cleanStanding,
  eventTier,
  fieldStrength,
  formatPlacement,
  hasStanding,
  legacyTier,
  ordinal,
  standingWritable,
  tierCounts,
  tierFor,
  tierLabel,
  trendPoint,
} from './placement';
import type { Event } from '../types';

function event(id: string, extra: Partial<Event> = {}): Event {
  return {
    id,
    name: id,
    type: 'Sealed',
    date: '2026-01-10',
    status: 'completed',
    matches: [],
    ...extra,
  };
}

// ─── ordinal ─────────────────────────────────────────────────────────────────

describe('ordinal', () => {
  it('usa o sufixo dos últimos dígitos', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(102)).toBe('102nd');
  });

  it('trata 11, 12 e 13 como excepção', () => {
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(111)).toBe('111th');
  });
});

// ─── tierFor ─────────────────────────────────────────────────────────────────

describe('tierFor', () => {
  it('escolhe o escalão mais apertado que cabe', () => {
    expect(tierFor(1, 32)).toBe(1);
    expect(tierFor(2, 32)).toBe(2);
    expect(tierFor(3, 32)).toBe(4);
    expect(tierFor(5, 32)).toBe(8);
    expect(tierFor(9, 32)).toBe(16);
    expect(tierFor(17, 64)).toBe(32);
  });

  it('recusa o escalão quando o campo não era maior do que ele', () => {
    // O caso que motivou o ADR pelo avesso: um Top 8 que era o torneio todo.
    expect(tierFor(5, 6)).toBeNull();
    expect(tierFor(5, 8)).toBeNull();
    expect(tierFor(3, 4)).toBeNull();
    expect(tierFor(2, 2)).toBeNull();
  });

  it('aceita o escalão assim que houver um jogador a mais', () => {
    expect(tierFor(5, 9)).toBe(8);
    expect(tierFor(3, 5)).toBe(4);
    expect(tierFor(2, 3)).toBe(2);
  });

  it('conta sempre o primeiro lugar', () => {
    expect(tierFor(1, 2)).toBe(1);
    expect(tierFor(1, 1)).toBe(1);
  });

  it('não inventa escalão para lá do último', () => {
    expect(tierFor(33, 128)).toBeNull();
    expect(tierFor(64, 128)).toBeNull();
  });

  it('sem número de jogadores dá o benefício da dúvida', () => {
    expect(tierFor(5)).toBe(8);
    expect(tierFor(1)).toBe(1);
  });

  it('não é posição o que não é inteiro positivo', () => {
    expect(tierFor(undefined, 32)).toBeNull();
    expect(tierFor(0, 32)).toBeNull();
    expect(tierFor(-3, 32)).toBeNull();
    expect(tierFor(2.5, 32)).toBeNull();
  });
});

// ─── tierLabel ───────────────────────────────────────────────────────────────

describe('tierLabel', () => {
  it('trata o primeiro lugar à parte — "Top 1" não se diz', () => {
    expect(tierLabel(1)).toBe('1st Place');
    expect(tierLabel(8)).toBe('Top 8');
    expect(tierLabel(32)).toBe('Top 32');
  });

  it('dá nome a todos os escalões que existem', () => {
    expect(TIERS.map(tierLabel)).toEqual(['1st Place', 'Top 2', 'Top 4', 'Top 8', 'Top 16', 'Top 32']);
  });
});

// ─── legacyTier ──────────────────────────────────────────────────────────────

describe('legacyTier', () => {
  it('lê as opções que o écran antigo oferecia', () => {
    expect(legacyTier('1st Place')).toBe(1);
    expect(legacyTier('Top 2')).toBe(2);
    expect(legacyTier('Top 8')).toBe(8);
    expect(legacyTier('Top 32')).toBe(32);
  });

  it('não se importa com maiúsculas nem com espaços a mais', () => {
    expect(legacyTier('  top 8 ')).toBe(8);
    expect(legacyTier('TOP8')).toBe(8);
    expect(legacyTier('1st')).toBe(1);
  });

  it('devolve null ao que não é escalão nenhum', () => {
    expect(legacyTier('Other')).toBeNull();
    expect(legacyTier('Top 5')).toBeNull();
    expect(legacyTier('')).toBeNull();
    expect(legacyTier(undefined)).toBeNull();
  });
});

// ─── eventTier ───────────────────────────────────────────────────────────────

describe('eventTier', () => {
  it('a posição manda sobre a string antiga', () => {
    expect(eventTier(event('e', { placement: 1, playersCount: 16, rank: 'Top 8' }))).toBe(1);
  });

  it('cai no rank antigo quando não há posição', () => {
    expect(eventTier(event('e', { rank: 'Top 16' }))).toBe(16);
  });

  it('havendo posição, ela decide mesmo quando a resposta é "escalão nenhum"', () => {
    // Um evento antigo que dizia "Top 8" e a que se acrescentou a posição a sério: o 40.º lugar
    // não é Top nada, e a string não pode responder por cima do facto.
    expect(eventTier(event('e', { placement: 40, rank: 'Top 8' }))).toBeNull();
  });

  it('não tem escalão nenhum quando não há nem uma coisa nem outra', () => {
    expect(eventTier(event('e'))).toBeNull();
  });
});

// ─── fieldStrength ───────────────────────────────────────────────────────────

describe('fieldStrength', () => {
  it('ganhar deixa o campo todo atrás', () => {
    expect(fieldStrength(1, 32)).toBe(1);
  });

  it('o último lugar não deixa ninguém atrás', () => {
    expect(fieldStrength(32, 32)).toBe(0);
  });

  it('distingue o mesmo lugar em campos diferentes', () => {
    const big   = fieldStrength(5, 32)!;
    const small = fieldStrength(5, 8)!;
    expect(big).toBeGreaterThan(small);
    expect(big).toBeCloseTo(27 / 31, 5);
    expect(small).toBeCloseTo(3 / 7, 5);
  });

  it('recusa números que não podem ser verdade ao mesmo tempo', () => {
    expect(fieldStrength(10, 8)).toBeNull();
  });

  it('precisa dos dois números', () => {
    expect(fieldStrength(5, undefined)).toBeNull();
    expect(fieldStrength(undefined, 32)).toBeNull();
  });

  it('num torneio de um jogador só não há campo a bater', () => {
    expect(fieldStrength(1, 1)).toBe(1);
  });
});

// ─── trendPoint ──────────────────────────────────────────────────────────────

describe('trendPoint', () => {
  it('mede quando tem os dois números', () => {
    expect(trendPoint(event('e', { placement: 1, playersCount: 32 }))).toEqual({
      value: 1,
      estimated: false,
    });
  });

  it('estima pelo escalão quando falta o campo, e diz que estimou', () => {
    const point = trendPoint(event('e', { placement: 5 }))!;
    expect(point.estimated).toBe(true);
    expect(point.value).toBeGreaterThan(0);
    expect(point.value).toBeLessThan(1);
  });

  it('estima também a partir do rank antigo', () => {
    expect(trendPoint(event('e', { rank: 'Top 4' }))!.estimated).toBe(true);
  });

  it('deixa de fora quem não tem resultado', () => {
    expect(trendPoint(event('e'))).toBeNull();
  });

  it('deixa de fora o evento a decorrer', () => {
    expect(trendPoint(event('e', { status: 'active', placement: 1, playersCount: 8 }))).toBeNull();
  });
});

// ─── formatPlacement ─────────────────────────────────────────────────────────

describe('formatPlacement', () => {
  it('diz a posição e o campo', () => {
    expect(formatPlacement(event('e', { placement: 5, playersCount: 32 }))).toBe('5th of 32');
  });

  it('diz só a posição quando o campo não foi registado', () => {
    expect(formatPlacement(event('e', { placement: 3 }))).toBe('3rd');
  });

  it('mostra o rank antigo tal e qual como está escrito', () => {
    expect(formatPlacement(event('e', { rank: 'Top 8' }))).toBe('Top 8');
  });

  it('não devolve nada quando não há resultado — quem desenha não mostra linha', () => {
    expect(formatPlacement(event('e'))).toBeUndefined();
    expect(formatPlacement(event('e', { rank: '   ' }))).toBeUndefined();
  });
});

// ─── hasStanding / tierCounts ────────────────────────────────────────────────

describe('hasStanding', () => {
  it('a posição sozinha já é resultado, mesmo sem escalão', () => {
    expect(hasStanding(event('e', { placement: 40, playersCount: 128 }))).toBe(true);
  });

  it('o rank antigo também', () => {
    expect(hasStanding(event('e', { rank: 'Top 8' }))).toBe(true);
  });

  it('um evento sem nada não tem resultado', () => {
    expect(hasStanding(event('e'))).toBe(false);
  });
});

describe('tierCounts', () => {
  const events = [
    event('a', { placement: 1,  playersCount: 24 }),   // 1st Place
    event('b', { placement: 5,  playersCount: 32 }),   // Top 8
    event('c', { placement: 5,  playersCount: 6 }),    // fora — o campo era mais pequeno
    event('d', { placement: 40, playersCount: 128 }),  // fora — para lá do último escalão
    event('e', { rank: 'Top 8' }),                     // Top 8, pelo campo antigo
    event('f'),                                        // sem resultado, não conta para nada
    event('g', { status: 'active', placement: 1, playersCount: 8 }), // a decorrer
  ];

  it('conta cada evento no escalão dele', () => {
    const { byTier } = tierCounts(events);
    expect(byTier[1]).toBe(1);
    expect(byTier[8]).toBe(2);
    expect(byTier[16]).toBe(0);
  });

  it('junta num só balde os que não couberam em escalão nenhum', () => {
    expect(tierCounts(events).outside).toBe(2);
  });

  it('o total é o dos eventos com resultado — sem os que não têm e sem o que decorre', () => {
    expect(tierCounts(events).total).toBe(5);
  });

  it('sem eventos fica tudo a zero em vez de rebentar', () => {
    const { byTier, outside, total } = tierCounts([]);
    expect(total).toBe(0);
    expect(outside).toBe(0);
    expect(byTier[1]).toBe(0);
  });
});

// ─── bestFinish ──────────────────────────────────────────────────────────────

describe('bestFinish', () => {
  it('prefere quem deixou mais campo para trás, e não a posição mais baixa', () => {
    const best = bestFinish([
      event('pequeno', { placement: 5, playersCount: 8 }),   // 0.43 do campo
      event('grande',  { placement: 8, playersCount: 64 }),  // 0.89 do campo
    ]);
    expect(best).toBe('8th of 64');
  });

  it('nenhum segundo lugar ultrapassa uma vitória — ganhar deixa o campo todo atrás', () => {
    expect(bestFinish([
      event('pequeno', { placement: 1, playersCount: 4 }),
      event('grande',  { placement: 2, playersCount: 64 }),
    ])).toBe('1st of 4');
  });

  it('empatados, ganha o torneio maior', () => {
    expect(bestFinish([
      event('a', { placement: 1, playersCount: 8 }),
      event('b', { placement: 1, playersCount: 64 }),
    ])).toBe('1st of 64');
  });

  it('não devolve nada quando nenhum evento tem resultado', () => {
    expect(bestFinish([event('a'), event('b', { status: 'active' })])).toBeUndefined();
  });

  it('sem eventos não devolve nada', () => {
    expect(bestFinish([])).toBeUndefined();
  });
});

// ─── cleanStanding ───────────────────────────────────────────────────────────

describe('cleanStanding', () => {
  it('deixa passar dois números que fazem sentido', () => {
    expect(cleanStanding({ placement: 5, playersCount: 32 })).toEqual({ placement: 5, playersCount: 32 });
  });

  it('deita fora o que não é posição', () => {
    expect(cleanStanding({ placement: 0, playersCount: -4 })).toEqual({
      placement: undefined,
      playersCount: undefined,
    });
    expect(cleanStanding({ placement: 2.5, playersCount: 32 }).placement).toBeUndefined();
  });

  it('não escreve uma posição órfã — é a Q15', () => {
    // Uma posição sem campo não se compara com nada, e o schema recusa-a (`dependencies`).
    expect(cleanStanding({ placement: 5 })).toEqual({
      placement: undefined,
      playersCount: undefined,
    });
  });

  it('num campo mais pequeno do que a posição, é a posição que cai', () => {
    // O que sobra continua a ser verdade; ficar com a posição deixaria um ficheiro inválido.
    expect(cleanStanding({ placement: 10, playersCount: 8 })).toEqual({
      placement: undefined,
      playersCount: 8,
    });
  });

  it('o número de jogadores pode ficar sozinho', () => {
    // É um facto sobre o torneio que se sabe sem se saber em que lugar se ficou.
    expect(cleanStanding({ playersCount: 32 })).toEqual({ placement: undefined, playersCount: 32 });
  });

  it('devolve sempre as duas chaves, para apagar o que lá estava', () => {
    expect(cleanStanding()).toEqual({ placement: undefined, playersCount: undefined });
    expect(Object.keys(cleanStanding()).sort()).toEqual(['placement', 'playersCount']);
  });
});

// ─── standingWritable ────────────────────────────────────────────────────────

describe('standingWritable', () => {
  it('um par coerente grava-se', () => {
    expect(standingWritable({ placement: 5, playersCount: 32 })).toBe(true);
    expect(standingWritable({ placement: 32, playersCount: 32 })).toBe(true);
  });

  it('não ter resultado nenhum também se grava', () => {
    expect(standingWritable()).toBe(true);
    expect(standingWritable({})).toBe(true);
    expect(standingWritable({ playersCount: 32 })).toBe(true);
  });

  it('uma posição sem campo não se grava', () => {
    expect(standingWritable({ placement: 5 })).toBe(false);
  });

  it('uma posição maior do que o campo não se grava', () => {
    expect(standingWritable({ placement: 10, playersCount: 8 })).toBe(false);
  });

  it('o que não é posição não passa por posição', () => {
    expect(standingWritable({ placement: 0, playersCount: 8 })).toBe(false);
    expect(standingWritable({ placement: 2.5, playersCount: 8 })).toBe(false);
  });

  it('concorda com o cleanStanding: o que é gravável sobrevive inteiro', () => {
    const cases = [
      { placement: 5, playersCount: 32 },
      { playersCount: 32 },
      { placement: 5 },
      { placement: 10, playersCount: 8 },
      {},
    ];

    for (const input of cases) {
      const cleaned = cleanStanding(input);
      const survived = cleaned.placement === input.placement;
      expect(standingWritable(input)).toBe(survived);
    }
  });
});
