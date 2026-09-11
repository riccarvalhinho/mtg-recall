/**
 * Regras de um match. Puro, sem I/O — ver CLAUDE.md § Convenções.
 *
 * Existe por uma razão só: o `tools/validate-data.mts` recusa um match cujo `result` não bata certo
 * com os `games`, e a app não pode escrever ficheiros que o seu próprio CI vai chumbar (é o que o
 * commit c81ac80 foi corrigir). Em vez de deixar o utilizador escolher o resultado e os games em
 * separado e depois torcer para coincidirem, o resultado passa a ser **derivado** quando há games.
 *
 * A regra tem de ser a mesma dos dois lados. Se mudar aqui, muda em `tools/validate-data.mts`.
 */
import type { Game, GameResult, MatchResult } from '../types';

/** Máximo de games num match, igual ao `maxItems` do schema. */
export const MAX_GAMES = 5;

/**
 * O resultado do match que os games ditam, ou `null` se não houver games.
 *
 * Empate quando estão empatados: um 1-1 com o terceiro game por jogar é, para efeitos de registo,
 * um empate. É a mesma conta que a validação faz.
 */
export function resultFromGames(games: Game[] | undefined): MatchResult | null {
  if (!games || games.length === 0) return null;

  const wins = games.filter((game) => game.result === 'W').length;
  const losses = games.length - wins;

  if (wins > losses) return 'W';
  if (losses > wins) return 'L';
  return 'D';
}

/**
 * Renumera os games a partir de 1, pela ordem em que estão.
 *
 * O schema exige `number` sequencial e a validação verifica-o. Apagar o game 2 de três deixaria
 * 1 e 3 sem isto.
 */
export function renumberGames(games: Game[]): Game[] {
  return games.map((game, index) => ({ ...game, number: index + 1 }));
}

/**
 * Acrescenta um game ao fim, até ao limite do schema.
 *
 * Devolve a lista inalterada quando já lá estão cinco — o ecrã não tem de saber o limite.
 */
export function addGame(games: Game[], result: GameResult, wentFirst?: boolean): Game[] {
  if (games.length >= MAX_GAMES) return games;
  return [...games, { number: games.length + 1, result, wentFirst }];
}

/** Tira um game e renumera os que ficam. */
export function removeGame(games: Game[], number: number): Game[] {
  return renumberGames(games.filter((game) => game.number !== number));
}

/** Troca o resultado de um game já registado. */
export function setGameResult(games: Game[], number: number, result: GameResult): Game[] {
  return games.map((game) => (game.number === number ? { ...game, result } : game));
}

/**
 * Alterna quem jogou primeiro num game: indefinido → na jogada → no draw → indefinido.
 *
 * Três estados e não dois porque "não registei" não é o mesmo que "fui eu a jogar segundo", e
 * escrever `false` por omissão seria inventar um dado que ninguém introduziu.
 */
export function cycleGameWentFirst(games: Game[], number: number): Game[] {
  return games.map((game) => {
    if (game.number !== number) return game;
    const next = game.wentFirst === undefined ? true : game.wentFirst ? false : undefined;
    return { ...game, wentFirst: next };
  });
}

/**
 * O `wentFirst` do match, que o schema define como "quem jogou primeiro no primeiro game".
 *
 * Com games registados, o primeiro game manda — dois sítios a dizer coisas diferentes sobre o mesmo
 * facto seria um bug à espera de acontecer. Sem games, vale o que o utilizador escolheu no match.
 */
export function matchWentFirst(games: Game[], fallback: boolean | undefined): boolean | undefined {
  if (games.length === 0) return fallback;
  return games[0].wentFirst;
}
