/**
 * Mexer na lista de cartas de um deck — puro, sem I/O e sem React.
 *
 * O editor de decks precisa de acrescentar, mudar quantidades, trocar de board e remover. Nada
 * disso é complicado, mas há uma regra que **tem** de estar num sítio só:
 *
 * > A mesma carta não pode aparecer duas vezes na mesma board.
 *
 * O `npm run validate` chumba isso (`"X" aparece 2 vezes no main — junta-as numa quantidade`), e
 * chumba-o **depois** de o commit já ter saído do telemóvel. Por isso as duas cartas juntam-se aqui,
 * ao acrescentar e ao trocar de board, em vez de se avisar quem está a escrever.
 *
 * A leitura da lista (curva, cores, tipos, contagens) vive em `domain/deck.ts`; isto é só a escrita.
 */
import type { DeckBoard, DeckCard } from '../types';

/** Os limites do schema (`quantity`: inteiro, 1–99). Repetidos aqui de propósito, como em `domain/sets.ts`. */
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99;

/** Ausente significa main — é o que diz o schema, e o que `domain/deck.ts` assume. */
export function boardOf(card: DeckCard): DeckBoard {
  return card.board === 'side' ? 'side' : 'main';
}

/**
 * A identidade de uma linha dentro da lista.
 *
 * É de propósito a mesma chave que o `tools/validate-data.mts` usa para apanhar repetições:
 * board mais nome em minúsculas. Se as duas divergirem, o editor deixa passar aquilo que o CI
 * chumba.
 */
export function cardKey(card: DeckCard): string {
  return `${boardOf(card)}:${card.name.trim().toLowerCase()}`;
}

/** Inteiro dentro de 1–99. Um 0 ou um negativo não é uma quantidade, é um pedido para remover. */
export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return MIN_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.floor(quantity)));
}

/** O que sobra de um campo de texto de quantidade. Vazio ou lixo vale 1. */
export function parseQuantity(input: string): number {
  const digits = input.replace(/[^0-9]/g, '');
  if (digits.length === 0) return MIN_QUANTITY;
  return clampQuantity(Number.parseInt(digits, 10));
}

/**
 * Junta duas linhas da mesma carta numa só.
 *
 * A quantidade soma-se (com tecto nas 99) e os campos da Scryfall do lado novo preenchem os buracos
 * do lado antigo: uma carta escrita à mão que depois seja encontrada na procura ganha `cmc` e
 * `typeLine` e passa a contar para a análise, em vez de ficar uma linha morta na lista.
 */
function merge(existing: DeckCard, incoming: DeckCard): DeckCard {
  return {
    ...existing,
    quantity: clampQuantity(existing.quantity + incoming.quantity),
    scryfallId: existing.scryfallId ?? incoming.scryfallId,
    manaCost:   existing.manaCost   ?? incoming.manaCost,
    cmc:        existing.cmc        ?? incoming.cmc,
    typeLine:   existing.typeLine   ?? incoming.typeLine,
    colors:     existing.colors     ?? incoming.colors,
  };
}

/** A linha com aquele nome naquela board, se existir. */
export function findCard(cards: DeckCard[], key: string): DeckCard | undefined {
  return cards.find(card => cardKey(card) === key);
}

/**
 * Acrescenta uma carta à lista, ou soma à que já lá está.
 *
 * Acrescentar quatro vezes a mesma carta dá uma linha com 4, e não quatro linhas com 1 — que é o
 * que o validador exige e, ainda por cima, o que alguém espera de uma lista de deck.
 */
export function addCard(cards: DeckCard[], entry: DeckCard): DeckCard[] {
  const key = cardKey(entry);
  const normalized: DeckCard = { ...entry, name: entry.name.trim(), quantity: clampQuantity(entry.quantity) };

  if (!findCard(cards, key)) return [...cards, normalized];
  return cards.map(card => (cardKey(card) === key ? merge(card, normalized) : card));
}

/** Tira a linha da lista. */
export function removeCard(cards: DeckCard[], key: string): DeckCard[] {
  return cards.filter(card => cardKey(card) !== key);
}

/** Põe a quantidade num valor exacto. Zero ou menos remove a linha. */
export function setQuantity(cards: DeckCard[], key: string, quantity: number): DeckCard[] {
  if (Number.isFinite(quantity) && Math.floor(quantity) < MIN_QUANTITY) return removeCard(cards, key);
  return cards.map(card => (cardKey(card) === key ? { ...card, quantity: clampQuantity(quantity) } : card));
}

/**
 * Soma (ou subtrai) à quantidade — é o que os botões de + e − fazem.
 *
 * Descer abaixo de 1 remove a linha: num telemóvel, carregar no − até desaparecer é mais natural do
 * que procurar um caixote do lixo, e evita a linha com zero cópias que o schema nem sequer aceita.
 */
export function changeQuantity(cards: DeckCard[], key: string, delta: number): DeckCard[] {
  const card = findCard(cards, key);
  if (!card) return cards;
  return setQuantity(cards, key, card.quantity + delta);
}

/**
 * Passa uma carta do main para o sideboard, ou ao contrário.
 *
 * Se a carta já existir do outro lado, as duas juntam-se: duas linhas da mesma carta na mesma board
 * seria exactamente a repetição que o validador chumba.
 */
export function setBoard(cards: DeckCard[], key: string, board: DeckBoard): DeckCard[] {
  const card = findCard(cards, key);
  if (!card || boardOf(card) === board) return cards;

  const moved: DeckCard = { ...card, board: board === 'side' ? 'side' : undefined };
  return addCard(removeCard(cards, key), moved);
}

/** As linhas de uma board, pela ordem em que estão na lista. */
export function cardsForBoard(cards: DeckCard[], board: DeckBoard): DeckCard[] {
  return cards.filter(card => boardOf(card) === board);
}

/**
 * Põe uma lista inteira em condições: quantidades dentro dos limites e repetições juntas.
 *
 * Serve para o editor abrir: um ficheiro de deck editado à mão no GitHub pode trazer a mesma carta
 * duas vezes ou uma quantidade a 0, e gravar por cima sem olhar era passar o problema adiante.
 */
export function normalizeDeckCards(cards: DeckCard[] | undefined): DeckCard[] {
  let result: DeckCard[] = [];
  for (const card of cards ?? []) {
    if (!card || typeof card.name !== 'string' || card.name.trim().length === 0) continue;
    result = addCard(result, { ...card, quantity: clampQuantity(card.quantity) });
  }
  return result;
}

/** O que vai para o store: `undefined` quando não há cartas, para o ficheiro não levar um array vazio. */
export function toStoredCards(cards: DeckCard[]): DeckCard[] | undefined {
  return cards.length > 0 ? cards : undefined;
}
