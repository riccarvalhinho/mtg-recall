import { describe, expect, it } from 'vitest';
import {
  MAX_QUICK_ROUNDS,
  appendResult,
  bareMatches,
  recordOf,
  removeLast,
} from './quickRecord';
import { calcEventStats } from '../types';
import type { MatchResult } from '../types';

describe('appendResult', () => {
  it('acrescenta ao fim, pela ordem de quem escreve', () => {
    let sequence: MatchResult[] = [];
    sequence = appendResult(sequence, 'W');
    sequence = appendResult(sequence, 'L');
    sequence = appendResult(sequence, 'W');
    expect(sequence).toEqual(['W', 'L', 'W']);
  });

  it('pára no tecto em vez de crescer sem fim', () => {
    const full: MatchResult[] = Array(MAX_QUICK_ROUNDS).fill('W');
    expect(appendResult(full, 'L')).toBe(full);
  });

  it('não mexe na lista que recebe', () => {
    const sequence: MatchResult[] = ['W'];
    appendResult(sequence, 'L');
    expect(sequence).toEqual(['W']);
  });
});

describe('removeLast', () => {
  it('tira a última', () => {
    expect(removeLast(['W', 'L', 'D'])).toEqual(['W', 'L']);
  });

  it('numa lista vazia não faz nada', () => {
    expect(removeLast([])).toEqual([]);
  });
});

describe('recordOf', () => {
  it('conta as três', () => {
    expect(recordOf(['W', 'W', 'L', 'D', 'W'])).toEqual({ wins: 3, losses: 1, draws: 1 });
  });

  it('uma sequência vazia é 0-0-0', () => {
    expect(recordOf([])).toEqual({ wins: 0, losses: 0, draws: 0 });
  });
});

describe('bareMatches', () => {
  it('numera as rondas a partir de 1', () => {
    expect(bareMatches(['W', 'L']).map(match => match.round)).toEqual([1, 2]);
  });

  it('acrescenta ao que já lá está, sem repetir rondas', () => {
    expect(bareMatches(['W', 'W'], 4).map(match => match.round)).toEqual([4, 5]);
  });

  // Ausente é ausente: um adversário inventado apareceria nas estatísticas como se fosse alguém.
  it('não inventa adversário, games nem quem jogou primeiro', () => {
    const [match] = bareMatches(['W']);
    expect(match.opponentId).toBeUndefined();
    expect(match.games).toBeUndefined();
    expect(match.wentFirst).toBeUndefined();
    expect(match.opponent).toBeUndefined();
  });

  // O schema exige o campo no match, e vazio é o que a app já escreve quando ninguém toca nos pips.
  it('as cores do adversário vão vazias, não ausentes', () => {
    expect(bareMatches(['L'])[0].opponentColors).toEqual({ main: [], splash: [] });
  });

  it('uma sequência vazia não dá ronda nenhuma', () => {
    expect(bareMatches([])).toEqual([]);
  });

  /**
   * A razão de existir do módulo: um 6-2 escrito assim tem de sair do `calcEventStats` como 6-2,
   * porque é dali que vêm o cartão do evento, a Home e o desempenho do deck.
   */
  it('o recorde sobrevive à ida para o evento', () => {
    const sequence: MatchResult[] = ['W', 'W', 'L', 'W', 'W', 'W', 'L', 'W'];
    const stats = calcEventStats({
      id: '2024-05-04-gp',
      name: 'GP',
      type: 'Modern',
      date: '2024-05-04',
      status: 'completed',
      matches: bareMatches(sequence),
    });

    expect({ wins: stats.wins, losses: stats.losses, draws: stats.draws })
      .toEqual(recordOf(sequence));
    expect(stats.winRate).toBe(75);
    expect(stats.points).toBe(18);
  });
});
