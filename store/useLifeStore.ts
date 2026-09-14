/**
 * A passagem dos games contados para o registo do match.
 *
 * É a mesma gaveta do `useScanStore`, e pela mesma razão: o contador não grava nada (ADR 0011) e
 * os parâmetros de navegação levam texto curto, não uma lista de games com a vida de cada um.
 *
 * O contador põe lá os games, o formulário tira-os **uma vez** ao ficar à frente. Tirar em vez de
 * ler é o que impede o mesmo jogo de ser acrescentado outra vez a cada redesenho do écran.
 *
 * Não é estado da app e não se guarda em lado nenhum: morre com a sessão. O que tem de sobreviver
 * a app fechada é a partida a meio, e essa vive no AsyncStorage, em `services/lifeSession.ts`.
 */
import { create } from 'zustand';
import type { Game } from '../types';

interface LifeStore {
  pending: Game[] | null;
  /** O contador entrega aqui os games que contou. */
  handOff: (games: Game[]) => void;
  /** O formulário tira-os e deixa a gaveta vazia. Devolve `null` quando não há nada. */
  take: () => Game[] | null;
}

export const useLifeStore = create<LifeStore>((set, get) => ({
  pending: null,

  handOff: (games) => set({ pending: games }),

  take: () => {
    const { pending } = get();
    if (pending) set({ pending: null });
    return pending;
  },
}));
