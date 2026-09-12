import { describe, expect, it } from 'vitest';
import {
  MIN_HIGHLIGHT_ENCOUNTERS,
  favouriteMatchup,
  headToHead,
  nemesis,
  opponentRecord,
  pruneOpponents,
  rankOpponents,
} from './opponents';
import type { Event, Match, Opponent } from '../types';

// ─── Auxiliares ──────────────────────────────────────────────────────────────

function match(opponentId: string, result: 'W' | 'L' | 'D', round = 1): Match {
  return {
    round,
    opponentId,
    opponent: opponentId,
    opponentColors: { main: [], splash: [] },
    result,
  };
}

/** Um evento com os matches pela ordem em que foram jogados, numerados a partir de 1. */
function event(id: string, date: string, matches: Match[]): Event {
  return {
    id,
    name: id,
    type: 'Modern',
    date,
    status: 'completed',
    matches: matches.map((m, index) => ({ ...m, round: index + 1 })),
  };
}

function opponent(id: string, name = id): Opponent {
  return { id, name };
}

// ─── opponentRecord ──────────────────────────────────────────────────────────

describe('opponentRecord', () => {
  it('soma os matches contra a mesma pessoa em todos os eventos', () => {
    const events = [
      event('2026-01-10-a', '2026-01-10', [match('rui', 'W'), match('ana', 'L')]),
      event('2026-02-14-b', '2026-02-14', [match('rui', 'L'), match('rui', 'W')]),
    ];

    const record = opponentRecord('rui', events);
    expect(record.played).toBe(3);
    expect(record.wins).toBe(2);
    expect(record.losses).toBe(1);
    expect(record.winRate).toBe(67); // 2 de 3
    expect(record.events).toBe(2);
    expect(record.lastPlayed).toBe('2026-02-14');
  });

  it('um adversário sem matches dá zeros e não rebenta', () => {
    const events = [event('2026-01-10-a', '2026-01-10', [match('rui', 'W')])];

    expect(opponentRecord('ninguem', events)).toMatchObject({
      played: 0,
      wins: 0,
      winRate: 0,
      events: 0,
      lastPlayed: null,
      name: '',
    });
  });

  it('sem eventos nenhuns também não rebenta', () => {
    expect(opponentRecord('rui', [])).toMatchObject({ played: 0, winRate: 0 });
  });

  it('eventos sem matches não contam como encontro', () => {
    const events = [
      event('2026-03-01-vazio', '2026-03-01', []),
      event('2026-01-10-a', '2026-01-10', [match('rui', 'W')]),
    ];

    const record = opponentRecord('rui', events);
    expect(record.events).toBe(1);
    expect(record.lastPlayed).toBe('2026-01-10');
  });

  it('conta os empates e mete-os no denominador do win rate', () => {
    const events = [
      event('2026-01-10-a', '2026-01-10', [match('rui', 'W'), match('rui', 'D')]),
    ];

    const record = opponentRecord('rui', events);
    expect(record.draws).toBe(1);
    expect(record.played).toBe(2);
    expect(record.winRate).toBe(50); // um empate não é meia vitória
  });

  it('um registo só de empates dá 0% sem ser uma derrota', () => {
    const events = [event('2026-01-10-a', '2026-01-10', [match('rui', 'D'), match('rui', 'D')])];

    expect(opponentRecord('rui', events)).toMatchObject({ draws: 2, wins: 0, winRate: 0 });
  });

  it('vai buscar o nome ao encontro mais recente, não ao primeiro que aparece', () => {
    const events = [
      event('2026-01-10-a', '2026-01-10', [{ ...match('rui', 'W'), opponent: 'Rui' }]),
      event('2026-02-14-b', '2026-02-14', [{ ...match('rui', 'L'), opponent: 'Rui Silva' }]),
    ];

    expect(opponentRecord('rui', events).name).toBe('Rui Silva');
  });
});

// ─── headToHead ──────────────────────────────────────────────────────────────

describe('headToHead', () => {
  it('devolve os matches do mais recente para o mais antigo, com o evento à mistura', () => {
    const events = [
      event('2026-01-10-a', '2026-01-10', [match('rui', 'W')]),
      event('2026-03-20-c', '2026-03-20', [match('rui', 'D')]),
      event('2026-02-14-b', '2026-02-14', [match('rui', 'L')]),
    ];

    const history = headToHead('rui', events);
    expect(history.map((entry) => entry.event.id)).toEqual([
      '2026-03-20-c',
      '2026-02-14-b',
      '2026-01-10-a',
    ]);
    expect(history[0].match.result).toBe('D');
  });

  it('dentro do mesmo evento, a ronda mais alta vem primeiro', () => {
    const events = [
      event('2026-01-10-a', '2026-01-10', [
        match('rui', 'W'), // ronda 1
        match('ana', 'L'), // ronda 2
        match('rui', 'L'), // ronda 3
      ]),
    ];

    expect(headToHead('rui', events).map((entry) => entry.match.round)).toEqual([3, 1]);
  });

  it('ignora os matches contra outra gente', () => {
    const events = [event('2026-01-10-a', '2026-01-10', [match('rui', 'W'), match('ana', 'W')])];

    expect(headToHead('ana', events)).toHaveLength(1);
  });

  it('sem encontros devolve uma lista vazia', () => {
    expect(headToHead('ninguem', [event('2026-01-10-a', '2026-01-10', [])])).toEqual([]);
  });
});

// ─── rankOpponents ───────────────────────────────────────────────────────────

describe('rankOpponents', () => {
  it('ordena por número de encontros, não por win rate', () => {
    const events = [
      // O "sortudo" apareceu uma vez e ganhei: 100%. Não pode passar à frente do rival de 4 jogos.
      event('2026-01-10-a', '2026-01-10', [
        match('rival', 'W'),
        match('rival', 'L'),
        match('sortudo', 'W'),
      ]),
      event('2026-02-14-b', '2026-02-14', [match('rival', 'W'), match('rival', 'L')]),
    ];

    const ranked = rankOpponents([opponent('sortudo'), opponent('rival')], events);
    expect(ranked.map((record) => record.opponentId)).toEqual(['rival', 'sortudo']);
  });

  it('com o mesmo número de encontros, o melhor win rate fica à frente', () => {
    const events = [
      event('2026-01-10-a', '2026-01-10', [
        match('bom', 'W'),
        match('bom', 'W'),
        match('mau', 'L'),
        match('mau', 'L'),
      ]),
    ];

    const ranked = rankOpponents([opponent('mau'), opponent('bom')], events);
    expect(ranked.map((record) => record.opponentId)).toEqual(['bom', 'mau']);
  });

  it('adversários ainda sem matches vão para o fim, mas não desaparecem', () => {
    const events = [event('2026-01-10-a', '2026-01-10', [match('rui', 'W')])];

    const ranked = rankOpponents([opponent('fantasma'), opponent('rui')], events);
    expect(ranked.map((record) => record.opponentId)).toEqual(['rui', 'fantasma']);
    expect(ranked).toHaveLength(2);
  });

  it('usa o nome da taxonomia e não o que ficou gravado no match', () => {
    const events = [
      event('2026-01-10-a', '2026-01-10', [{ ...match('rui', 'W'), opponent: 'nome antigo' }]),
    ];

    expect(rankOpponents([opponent('rui', 'Rui Silva')], events)[0].name).toBe('Rui Silva');
  });

  it('sem adversários na taxonomia devolve uma lista vazia', () => {
    expect(rankOpponents([], [event('2026-01-10-a', '2026-01-10', [match('rui', 'W')])])).toEqual([]);
  });
});

// ─── nemesis e favouriteMatchup ──────────────────────────────────────────────

/** Um evento com N matches contra a mesma pessoa, para chegar ao mínimo sem escrever dez linhas. */
function series(id: string, date: string, opponentId: string, results: ('W' | 'L' | 'D')[]): Event {
  return event(id, date, results.map((result) => match(opponentId, result)));
}

describe('nemesis', () => {
  it('é o pior registo de entre quem já se enfrentou o suficiente', () => {
    const events = [
      series('2026-01-10-a', '2026-01-10', 'carrasco', ['L', 'L', 'L', 'W']),
      series('2026-02-14-b', '2026-02-14', 'normal', ['W', 'L', 'W']),
    ];

    const worst = nemesis([opponent('carrasco'), opponent('normal')], events);
    expect(worst?.opponentId).toBe('carrasco');
    expect(worst?.winRate).toBe(25);
  });

  it('ignora quem se enfrentou poucas vezes — um 0% de uma derrota é ruído', () => {
    const events = [
      event('2026-01-10-a', '2026-01-10', [match('passageiro', 'L')]),
      series('2026-02-14-b', '2026-02-14', 'habitual', ['W', 'L', 'W']),
    ];

    expect(nemesis([opponent('passageiro'), opponent('habitual')], events)?.opponentId).toBe(
      'habitual',
    );
  });

  it('devolve null enquanto ninguém chegar ao mínimo de encontros', () => {
    const events = [
      series('2026-01-10-a', '2026-01-10', 'rui', ['L', 'L']), // um abaixo do mínimo
    ];

    expect(MIN_HIGHLIGHT_ENCOUNTERS).toBe(3);
    expect(nemesis([opponent('rui')], events)).toBeNull();
  });

  it('sem eventos nenhuns devolve null em vez de inventar um vilão', () => {
    expect(nemesis([opponent('rui')], [])).toBeNull();
  });

  it('com win rates empatados fica quem se enfrentou mais vezes', () => {
    const events = [
      series('2026-01-10-a', '2026-01-10', 'muitos', ['W', 'L', 'L', 'W', 'L', 'L']), // 33%
      series('2026-02-14-b', '2026-02-14', 'poucos', ['W', 'L', 'L']), // 33%
    ];

    expect(nemesis([opponent('poucos'), opponent('muitos')], events)?.opponentId).toBe('muitos');
  });
});

describe('favouriteMatchup', () => {
  it('é o melhor registo de entre quem já se enfrentou o suficiente', () => {
    const events = [
      series('2026-01-10-a', '2026-01-10', 'vitima', ['W', 'W', 'W', 'L']),
      series('2026-02-14-b', '2026-02-14', 'normal', ['W', 'L', 'W']),
    ];

    expect(favouriteMatchup([opponent('vitima'), opponent('normal')], events)?.opponentId).toBe(
      'vitima',
    );
  });

  it('não se deixa enganar por um 100% de um único encontro', () => {
    const events = [
      event('2026-01-10-a', '2026-01-10', [match('sortudo', 'W')]),
      series('2026-02-14-b', '2026-02-14', 'habitual', ['W', 'W', 'L']),
    ];

    expect(favouriteMatchup([opponent('sortudo'), opponent('habitual')], events)?.opponentId).toBe(
      'habitual',
    );
  });

  it('devolve null quando ainda não há encontros que cheguem', () => {
    expect(favouriteMatchup([opponent('rui')], [])).toBeNull();
  });

  it('com um só candidato, é ao mesmo tempo o melhor e o pior — e o écran é que decide', () => {
    const events = [series('2026-01-10-a', '2026-01-10', 'unico', ['W', 'L', 'W'])];
    const only = [opponent('unico')];

    expect(favouriteMatchup(only, events)?.opponentId).toBe('unico');
    expect(nemesis(only, events)?.opponentId).toBe('unico');
  });
});

describe('pruneOpponents', () => {
  const ana: Opponent = { id: 'ana', name: 'Ana' };
  const bruno: Opponent = { id: 'bruno', name: 'Bruno' };

  function eventWith(id: string, opponentIds: string[]): Event {
    return {
      id,
      name: id,
      type: 'Modern',
      date: '2026-01-01',
      status: 'completed',
      matches: opponentIds.map((opponentId, index) => ({
        round: index + 1,
        opponentId,
        opponent: opponentId,
        opponentColors: { main: [], splash: [] },
        result: 'W' as const,
      })),
    };
  }

  it('tira quem já não é referido por match nenhum', () => {
    // O caso real: o nome estava mal escrito, foi corrigido no match, e o id antigo ficou órfão.
    const gralha: Opponent = { id: 'anna', name: 'Anna' };
    expect(pruneOpponents([gralha, ana], [eventWith('e', ['ana'])])).toEqual([ana]);
  });

  it('mantém quem é referido, mesmo que noutro evento', () => {
    const events = [eventWith('e1', ['ana']), eventWith('e2', ['bruno'])];
    expect(pruneOpponents([ana, bruno], events)).toEqual([ana, bruno]);
  });

  it('apagar o único evento de alguém tira-o da lista', () => {
    expect(pruneOpponents([ana, bruno], [eventWith('e', ['ana'])])).toEqual([ana]);
  });

  it('sem eventos não sobra ninguém', () => {
    expect(pruneOpponents([ana, bruno], [])).toEqual([]);
  });

  it('não reordena o que fica', () => {
    // Reordenar daria um diff do ficheiro inteiro por causa de uma linha removida.
    const carla: Opponent = { id: 'carla', name: 'Carla' };
    const events = [eventWith('e', ['carla', 'ana'])];
    expect(pruneOpponents([ana, carla], events)).toEqual([ana, carla]);
  });
});
