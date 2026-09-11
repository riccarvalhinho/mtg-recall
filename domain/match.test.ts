import { describe, expect, it } from 'vitest';
import {
  MAX_GAMES,
  addGame,
  cycleGameWentFirst,
  matchWentFirst,
  removeGame,
  renumberGames,
  resultFromGames,
  setGameResult,
} from './match';
import type { Game } from '../types';

/** Atalho para não escrever `number` à mão em cada teste. */
function games(...results: ('W' | 'L')[]): Game[] {
  return results.map((result, index) => ({ number: index + 1, result }));
}

describe('resultFromGames', () => {
  it('sem games não deriva resultado nenhum', () => {
    expect(resultFromGames([])).toBeNull();
    expect(resultFromGames(undefined)).toBeNull();
  });

  it('2-0 é vitória', () => {
    expect(resultFromGames(games('W', 'W'))).toBe('W');
  });

  it('2-1 é vitória', () => {
    expect(resultFromGames(games('W', 'L', 'W'))).toBe('W');
  });

  it('1-2 é derrota', () => {
    expect(resultFromGames(games('L', 'W', 'L'))).toBe('L');
  });

  it('0-2 é derrota', () => {
    expect(resultFromGames(games('L', 'L'))).toBe('L');
  });

  it('1-1 é empate — o terceiro game por jogar conta como empate, tal como na validação', () => {
    expect(resultFromGames(games('W', 'L'))).toBe('D');
  });

  it('um game só decide o match', () => {
    expect(resultFromGames(games('W'))).toBe('W');
    expect(resultFromGames(games('L'))).toBe('L');
  });
});

describe('addGame', () => {
  it('acrescenta ao fim e numera a seguir', () => {
    const result = addGame(games('W'), 'L');
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ number: 2, result: 'L', wentFirst: undefined });
  });

  it('guarda o wentFirst quando é dado', () => {
    expect(addGame([], 'W', true)[0].wentFirst).toBe(true);
  });

  it('recusa passar do limite do schema', () => {
    const full = games('W', 'L', 'W', 'L', 'W');
    expect(full).toHaveLength(MAX_GAMES);
    expect(addGame(full, 'W')).toEqual(full);
  });
});

describe('removeGame', () => {
  it('tira o game e renumera os que ficam', () => {
    const result = removeGame(games('W', 'L', 'W'), 2);
    expect(result.map((game) => game.number)).toEqual([1, 2]);
    expect(result.map((game) => game.result)).toEqual(['W', 'W']);
  });

  it('tirar um que não existe não mexe em nada', () => {
    expect(removeGame(games('W'), 9)).toEqual(games('W'));
  });
});

describe('renumberGames', () => {
  it('põe a numeração de volta a 1..n', () => {
    const desalinhados: Game[] = [
      { number: 4, result: 'W' },
      { number: 7, result: 'L' },
    ];
    expect(renumberGames(desalinhados).map((game) => game.number)).toEqual([1, 2]);
  });
});

describe('setGameResult', () => {
  it('troca só o game indicado', () => {
    const result = setGameResult(games('W', 'W'), 2, 'L');
    expect(result.map((game) => game.result)).toEqual(['W', 'L']);
  });
});

describe('cycleGameWentFirst', () => {
  it('anda indefinido → true → false → indefinido', () => {
    let current = games('W');
    current = cycleGameWentFirst(current, 1);
    expect(current[0].wentFirst).toBe(true);

    current = cycleGameWentFirst(current, 1);
    expect(current[0].wentFirst).toBe(false);

    current = cycleGameWentFirst(current, 1);
    expect(current[0].wentFirst).toBeUndefined();
  });
});

describe('matchWentFirst', () => {
  it('sem games vale o que o utilizador escolheu no match', () => {
    expect(matchWentFirst([], true)).toBe(true);
    expect(matchWentFirst([], undefined)).toBeUndefined();
  });

  it('com games manda o primeiro game, não o campo do match', () => {
    const comPrimeiro: Game[] = [
      { number: 1, result: 'W', wentFirst: false },
      { number: 2, result: 'W', wentFirst: true },
    ];
    expect(matchWentFirst(comPrimeiro, true)).toBe(false);
  });
});
