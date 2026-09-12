/**
 * A passagem do resultado do scan para o editor de deck.
 *
 * O écran de captura não grava nada: quem grava é o editor, onde a lista está a ser mexida e ainda
 * não foi para ficheiro nenhum. Faltava uma forma de lhe entregar as cartas, e os parâmetros de
 * navegação não servem — levam texto curto, não uma decklist.
 *
 * Daí esta gaveta: o scan põe lá as cartas, o editor tira-as **uma vez** ao voltar a ficar à
 * frente. Tirar em vez de ler é o que evita o mesmo scan ser acrescentado outra vez a cada vez que
 * o écran se redesenha.
 *
 * Não é estado da app e não se guarda em lado nenhum: morre com a sessão, como deve.
 */
import { create } from 'zustand';
import type { DeckCard } from '../types';

interface ScanStore {
  pending: DeckCard[] | null;
  /** O scan entrega aqui o que a confirmação aprovou. */
  handOff: (cards: DeckCard[]) => void;
  /** O editor tira as cartas e deixa a gaveta vazia. Devolve `null` quando não há nada. */
  take: () => DeckCard[] | null;
}

export const useScanStore = create<ScanStore>((set, get) => ({
  pending: null,

  handOff: (cards) => set({ pending: cards }),

  take: () => {
    const { pending } = get();
    if (pending) set({ pending: null });
    return pending;
  },
}));
