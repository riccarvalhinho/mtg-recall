/**
 * O contador de vida. Puro, sem I/O — ver CLAUDE.md § Convenções.
 *
 * O que este módulo sabe: dois totais de vida, uma lista de games já acabados, e como transformar
 * isso nos `Game[]` que o registo de match já sabe ler. O que **não** sabe: écrans, AsyncStorage,
 * navegação. É de propósito — é o que permite testar um torneio inteiro aqui, sem telemóvel.
 *
 * A decisão de fundo está no ADR 0011: o contador é uma ferramenta, não um registo. Do jogo inteiro
 * sobrevive uma coisa só, a vida com que cada game acabou, e o resultado do match continua a sair
 * dos games pela regra que já existia em `domain/match.ts`.
 */
import { MAX_GAMES, resultFromGames } from './match';
import type { Game, GameLife, GameResult, MatchResult } from '../types';

/** A vida inicial quando ninguém escolheu nada. Um Commander escolhe 40 na gaveta de opções. */
export const DEFAULT_STARTING_LIFE = 20;

/** Os valores que a gaveta de opções oferece. Fora daqui, escreve-se à mão. */
export const STARTING_LIFE_OPTIONS = [20, 25, 30, 40, 50, 60];

/** Quem leva com a alteração. `me` sou eu; `opponent` é o outro lado do telemóvel. */
export type LifeSide = 'me' | 'opponent';

/** Um game que já acabou: quem o ganhou e a vida com que ficou cada um. */
export interface FinishedGame {
  result: GameResult;
  life: GameLife;
}

/**
 * Uma partida a ser contada.
 *
 * `current` é o game a decorrer e `finished` os que já acabaram. A vida inicial fica guardada
 * porque cada game novo volta a ela — e porque mudá-la a meio de uma partida não pode reescrever
 * os games que já acabaram.
 */
export interface LifeSession {
  startingLife: number;
  current: GameLife;
  finished: FinishedGame[];
}

export function newSession(startingLife: number = DEFAULT_STARTING_LIFE): LifeSession {
  return {
    startingLife,
    current: { me: startingLife, opponent: startingLife },
    finished: [],
  };
}

/**
 * Soma (ou subtrai) vida a um dos lados.
 *
 * Sem limites nos dois sentidos. Abaixo de zero porque se perde a menos de zero e um `-3` é o que
 * aconteceu; acima porque a vida sobe sem tecto e um máximo inventado só daria um travão onde o
 * jogo não tem nenhum.
 */
export function adjust(session: LifeSession, side: LifeSide, by: number): LifeSession {
  return {
    ...session,
    current: { ...session.current, [side]: session.current[side] + by },
  };
}

/**
 * Quem é que o estado actual diz que ganhou o game — ou `null` se ainda não diz nada.
 *
 * Zero ou menos perde-se; é a regra do jogo e é o que faz o contador propor um resultado sem
 * ninguém carregar em nada.
 *
 * **Os dois a zero não propõem nada**, e não é um esquecimento: em Magic os dois a chegarem a zero
 * ao mesmo tempo é um empate, e um game empatado não cabe no ficheiro — `data/schema/event.schema.json`
 * diz `enum: ["W", "L"]` nos games, porque o empate só existe ao nível do match. Propor `W` ou `L`
 * seria escolher por alguém; devolver `null` deixa quem está a jogar fechar o game à mão, que é o
 * único sítio onde a informação existe.
 */
export function proposedResult(session: LifeSession): GameResult | null {
  const meDead = session.current.me <= 0;
  const opponentDead = session.current.opponent <= 0;

  if (meDead && opponentDead) return null;
  if (opponentDead) return 'W';
  if (meDead) return 'L';
  return null;
}

/** Há espaço para mais um game? O limite é o do schema, e vem de `domain/match.ts`. */
export function canFinishGame(session: LifeSession): boolean {
  return session.finished.length < MAX_GAMES;
}

/**
 * Fecha o game a decorrer e começa outro na vida inicial.
 *
 * A vida guardada é a do momento em que se fecha — não a de quando alguém chegou a zero. São a
 * mesma coisa quase sempre, e quando não são é porque se corrigiu um engano antes de fechar, que é
 * precisamente a correcção que se quer guardar.
 *
 * Ao quinto game devolve a sessão como está: o écran não tem de saber o limite do schema.
 */
export function finishGame(session: LifeSession, result: GameResult): LifeSession {
  if (!canFinishGame(session)) return session;

  return {
    ...session,
    current: { me: session.startingLife, opponent: session.startingLife },
    finished: [...session.finished, { result, life: { ...session.current } }],
  };
}

/**
 * Desfaz o último game fechado e devolve o contador ao ponto em que ele acabou.
 *
 * Repor a vida guardada e não a inicial é o que torna isto um "desfazer" a sério: fechou-se o game
 * por engano, volta-se e continua-se de onde se estava.
 */
export function undoLastGame(session: LifeSession): LifeSession {
  const last = session.finished[session.finished.length - 1];
  if (!last) return session;

  return {
    ...session,
    current: { ...last.life },
    finished: session.finished.slice(0, -1),
  };
}

/**
 * Os games como o registo de match os quer: numerados a partir de 1, cada um com a sua vida.
 *
 * `wentFirst` fica de fora de propósito. O contador não sabe quem jogou primeiro — ninguém lho
 * disse — e escrever `false` por omissão seria inventar um dado, que é a mesma regra dos três
 * estados em `domain/match.ts`. Quem souber, marca-o no formulário.
 */
export function toGames(session: LifeSession): Game[] {
  return session.finished.map((game, index) => ({
    number: index + 1,
    result: game.result,
    life: { ...game.life },
  }));
}

/** O resultado do match que estes games dão, pela regra única de `domain/match.ts`. */
export function sessionResult(session: LifeSession): MatchResult | null {
  return resultFromGames(toGames(session));
}

/** Quantos games se ganharam e se perderam até agora. Para o écran mostrar "2-1" sem contar à mão. */
export function sessionScore(session: LifeSession): { wins: number; losses: number } {
  const wins = session.finished.filter((game) => game.result === 'W').length;
  return { wins, losses: session.finished.length - wins };
}

/**
 * A que ronda pertence uma partida a contar — ou `null` numa partida casual.
 *
 * Existe por causa de um erro que só aparece na loja: fecha-se a app a meio da ronda 2, abre-se na
 * ronda 3, e o contador mostrava 12-7 da ronda anterior como se fosse o jogo a decorrer. Com chave,
 * a sessão guardada só volta para o sítio de onde saiu.
 */
export function sessionKey(eventId?: string, round?: number): string | null {
  if (!eventId || !round) return null;
  return `${eventId}:${round}`;
}

/** O que ficou guardado, com a ronda a que pertencia. */
export interface StoredSession {
  key: string | null;
  session: LifeSession;
}

/**
 * A sessão guardada serve para esta ronda?
 *
 * Só quando a chave bate certo. Uma partida casual (`null`) também só se restaura para outra
 * partida casual: os totais de um jogo na mesa da cozinha não têm nada que ver com a ronda 3 de um
 * FNM, e vice-versa.
 */
export function restorable(stored: StoredSession | undefined, key: string | null): LifeSession | null {
  if (!stored) return null;
  return stored.key === key ? stored.session : null;
}

export function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false;
  const stored = value as Partial<StoredSession>;
  if (stored.key !== null && typeof stored.key !== 'string') return false;
  return isLifeSession(stored.session);
}

/**
 * Uma sessão vinda do AsyncStorage é de confiar?
 *
 * Vale a mesma regra das preferências (ADR 0010): uma sessão ilegível — de uma versão anterior da
 * app, ou meio escrita quando o Android matou o processo — é o mesmo que não haver sessão nenhuma,
 * e a app abre à mesma. Nada disto pode ficar entre o utilizador e o registo de um match.
 */
export function isLifeSession(value: unknown): value is LifeSession {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Partial<LifeSession>;

  if (!Number.isInteger(session.startingLife)) return false;
  if (!isLife(session.current)) return false;
  if (!Array.isArray(session.finished)) return false;

  return session.finished.every(
    (game: unknown) =>
      typeof game === 'object' &&
      game !== null &&
      ((game as FinishedGame).result === 'W' || (game as FinishedGame).result === 'L') &&
      isLife((game as FinishedGame).life),
  );
}

function isLife(value: unknown): value is GameLife {
  if (typeof value !== 'object' || value === null) return false;
  const life = value as Partial<GameLife>;
  return Number.isInteger(life.me) && Number.isInteger(life.opponent);
}
