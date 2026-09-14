import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STARTING_LIFE,
  adjust,
  canFinishGame,
  finishGame,
  isLifeSession,
  isStoredSession,
  newSession,
  proposedResult,
  restorable,
  sessionKey,
  sessionResult,
  sessionScore,
  toGames,
  undoLastGame,
} from './lifeCounter';
import type { LifeSession } from './lifeCounter';

/** Tira n de vida ao adversário, um toque de cada vez, como acontece no écran. */
function hit(session: LifeSession, side: 'me' | 'opponent', times: number): LifeSession {
  let next = session;
  for (let i = 0; i < times; i++) next = adjust(next, side, -1);
  return next;
}

describe('newSession', () => {
  it('começa com os dois na vida inicial e sem games', () => {
    const session = newSession();
    expect(session.current).toEqual({ me: 20, opponent: 20 });
    expect(session.finished).toEqual([]);
    expect(session.startingLife).toBe(DEFAULT_STARTING_LIFE);
  });

  it('aceita outra vida inicial — um Commander começa a 40', () => {
    expect(newSession(40).current).toEqual({ me: 40, opponent: 40 });
  });
});

describe('adjust', () => {
  it('tira e põe vida a um lado sem tocar no outro', () => {
    const session = adjust(newSession(), 'opponent', -3);
    expect(session.current).toEqual({ me: 20, opponent: 17 });
  });

  it('deixa a vida passar abaixo de zero — perde-se a menos de zero', () => {
    expect(hit(newSession(), 'me', 23).current.me).toBe(-3);
  });

  it('não põe tecto: a vida sobe sem limite', () => {
    expect(adjust(newSession(), 'me', 40).current.me).toBe(60);
  });

  it('não muda a sessão original', () => {
    const before = newSession();
    adjust(before, 'me', -5);
    expect(before.current.me).toBe(20);
  });
});

describe('proposedResult', () => {
  it('não propõe nada enquanto os dois estiverem vivos', () => {
    expect(proposedResult(hit(newSession(), 'opponent', 19))).toBeNull();
  });

  it('o adversário a zero é vitória', () => {
    expect(proposedResult(hit(newSession(), 'opponent', 20))).toBe('W');
  });

  it('eu a zero é derrota', () => {
    expect(proposedResult(hit(newSession(), 'me', 20))).toBe('L');
  });

  it('abaixo de zero conta como morto', () => {
    expect(proposedResult(hit(newSession(), 'opponent', 24))).toBe('W');
  });

  it('os dois a zero não propõem nada — um game empatado não cabe no ficheiro', () => {
    // Em Magic é um empate; no schema, um game é W ou L e o empate só existe no match.
    // Escolher por alguém seria inventar o resultado.
    const both = hit(hit(newSession(), 'me', 20), 'opponent', 20);
    expect(proposedResult(both)).toBeNull();
  });
});

describe('finishGame', () => {
  it('guarda a vida do momento em que se fecha e recomeça na vida inicial', () => {
    const session = finishGame(hit(newSession(), 'opponent', 20), 'W');
    expect(session.finished).toEqual([{ result: 'W', life: { me: 20, opponent: 0 } }]);
    expect(session.current).toEqual({ me: 20, opponent: 20 });
  });

  it('guarda a correcção feita antes de fechar, e não o momento em que se chegou a zero', () => {
    // Tirou-se vida a mais por engano e corrigiu-se antes de fechar. O que fica é o corrigido.
    const enganado = hit(newSession(), 'opponent', 22);
    const corrigido = adjust(enganado, 'opponent', 2);
    expect(finishGame(corrigido, 'W').finished[0].life.opponent).toBe(0);
  });

  it('a vida guardada não fica presa ao contador', () => {
    const session = finishGame(hit(newSession(), 'opponent', 20), 'W');
    const depois = adjust(session, 'opponent', -5);
    expect(depois.finished[0].life).toEqual({ me: 20, opponent: 0 });
  });

  it('aceita fechar um game com os dois vivos — concede-se, moe-se, ganha-se por veneno', () => {
    const session = finishGame(hit(newSession(), 'opponent', 4), 'W');
    expect(session.finished[0].life).toEqual({ me: 20, opponent: 16 });
  });

  it('ao quinto game não aceita mais nenhum, como o schema exige', () => {
    let session = newSession();
    for (let i = 0; i < 5; i++) session = finishGame(session, 'W');
    expect(canFinishGame(session)).toBe(false);
    expect(finishGame(session, 'W').finished).toHaveLength(5);
  });
});

describe('undoLastGame', () => {
  it('devolve o contador ao ponto em que o game acabou, e não à vida inicial', () => {
    const session = finishGame(hit(hit(newSession(), 'opponent', 20), 'me', 6), 'W');
    const desfeito = undoLastGame(session);
    expect(desfeito.current).toEqual({ me: 14, opponent: 0 });
    expect(desfeito.finished).toEqual([]);
  });

  it('sem games fechados não faz nada', () => {
    const session = hit(newSession(), 'me', 3);
    expect(undoLastGame(session)).toEqual(session);
  });

  it('desfaz um de cada vez', () => {
    const session = finishGame(finishGame(newSession(), 'W'), 'L');
    expect(undoLastGame(session).finished).toHaveLength(1);
    expect(undoLastGame(session).finished[0].result).toBe('W');
  });
});

describe('toGames', () => {
  it('numera a partir de 1 e leva a vida de cada um', () => {
    let session = finishGame(hit(newSession(), 'opponent', 20), 'W');
    session = finishGame(hit(session, 'me', 17), 'L');
    expect(toGames(session)).toEqual([
      { number: 1, result: 'W', life: { me: 20, opponent: 0 } },
      { number: 2, result: 'L', life: { me: 3, opponent: 20 } },
    ]);
  });

  it('não inventa wentFirst — o contador não sabe quem jogou primeiro', () => {
    const games = toGames(finishGame(newSession(), 'W'));
    expect(games[0]).not.toHaveProperty('wentFirst');
  });

  it('sem games fechados devolve lista vazia', () => {
    expect(toGames(newSession())).toEqual([]);
  });
});

describe('sessionResult', () => {
  it('segue a mesma regra de domain/match.ts', () => {
    const win = finishGame(finishGame(newSession(), 'W'), 'W');
    const loss = finishGame(finishGame(newSession(), 'L'), 'L');
    const draw = finishGame(finishGame(newSession(), 'W'), 'L');
    expect(sessionResult(win)).toBe('W');
    expect(sessionResult(loss)).toBe('L');
    expect(sessionResult(draw)).toBe('D');
  });

  it('sem games não há resultado nenhum', () => {
    expect(sessionResult(newSession())).toBeNull();
  });
});

describe('sessionScore', () => {
  it('conta as vitórias e as derrotas', () => {
    const session = finishGame(finishGame(finishGame(newSession(), 'W'), 'L'), 'W');
    expect(sessionScore(session)).toEqual({ wins: 2, losses: 1 });
  });
});

describe('isLifeSession', () => {
  it('aceita uma sessão inteira', () => {
    expect(isLifeSession(finishGame(newSession(), 'W'))).toBe(true);
  });

  it('recusa o que não é sessão nenhuma', () => {
    expect(isLifeSession(null)).toBe(false);
    expect(isLifeSession('20')).toBe(false);
    expect(isLifeSession({})).toBe(false);
  });

  it('recusa uma sessão a que falta metade da vida', () => {
    expect(isLifeSession({ startingLife: 20, current: { me: 12 }, finished: [] })).toBe(false);
  });

  it('recusa um game guardado com um resultado que o schema não tem', () => {
    expect(isLifeSession({
      startingLife: 20,
      current: { me: 20, opponent: 20 },
      finished: [{ result: 'D', life: { me: 0, opponent: 0 } }],
    })).toBe(false);
  });

  it('recusa vida que não é inteira — um ficheiro meio escrito não passa por bom', () => {
    expect(isLifeSession({
      startingLife: 20,
      current: { me: 12.5, opponent: 20 },
      finished: [],
    })).toBe(false);
  });
});

describe('sessionKey', () => {
  it('junta o evento e a ronda', () => {
    expect(sessionKey('2026-04-12-fnm-sealed', 3)).toBe('2026-04-12-fnm-sealed:3');
  });

  it('uma partida casual não tem chave nenhuma', () => {
    expect(sessionKey(undefined, undefined)).toBeNull();
    expect(sessionKey('2026-04-12-fnm-sealed', undefined)).toBeNull();
    expect(sessionKey(undefined, 3)).toBeNull();
  });
});

describe('restorable', () => {
  const session = finishGame(newSession(), 'W');

  it('devolve a sessão quando a chave bate certo', () => {
    expect(restorable({ key: 'fnm:3', session }, 'fnm:3')).toBe(session);
  });

  it('recusa a sessão da ronda anterior', () => {
    // O erro que isto evita: fechar a app a meio da ronda 2 e abrir o contador na ronda 3 com
    // os totais da ronda 2 lá dentro.
    expect(restorable({ key: 'fnm:2', session }, 'fnm:3')).toBeNull();
  });

  it('não passa uma partida casual para uma ronda, nem o contrário', () => {
    expect(restorable({ key: null, session }, 'fnm:3')).toBeNull();
    expect(restorable({ key: 'fnm:3', session }, null)).toBeNull();
  });

  it('duas partidas casuais seguidas continuam a mesma — é o jogo que ficou a meio', () => {
    expect(restorable({ key: null, session }, null)).toBe(session);
  });

  it('sem nada guardado não devolve nada', () => {
    expect(restorable(undefined, 'fnm:3')).toBeNull();
  });
});

describe('isStoredSession', () => {
  it('aceita o que foi guardado', () => {
    expect(isStoredSession({ key: 'fnm:3', session: newSession() })).toBe(true);
    expect(isStoredSession({ key: null, session: newSession() })).toBe(true);
  });

  it('recusa uma chave que não é chave e uma sessão estragada', () => {
    expect(isStoredSession({ key: 3, session: newSession() })).toBe(false);
    expect(isStoredSession({ key: null, session: { startingLife: 20 } })).toBe(false);
  });
});
