/**
 * Os terrenos básicos, que se acrescentam por contador e não pela procura.
 *
 * Procurar "Island" na barra e escolher uma impressão, oito vezes, para pôr oito ilhas num deck é
 * trabalho a troco de nada: são sempre as mesmas seis cartas e o que muda é só o número. Por isso
 * têm um painel próprio — foi pedido explícito, e a app de referência faz o mesmo
 * (`design/referencia-manabox/02-basic-lands.jpg`).
 *
 * Entram **sem `scryfallId`**: qual das centenas de impressões de Island se tem no deck não é
 * informação que alguém queira dar. A consequência assumida é não terem preço (ADR 0007), e é
 * irrelevante — um básico não vale nada.
 *
 * Levam `typeLine` na mesma, e isso não é acessório: é o que faz `manaCurve` deixá-los de fora da
 * barra do zero e `typeCounts` contá-los como Land. Sem a linha de tipo, vinte terrenos apareciam
 * como vinte cartas grátis no gráfico.
 */
import type { DeckCard, ManaColor } from '../types';
import { boardOf } from './deckList';

/** `null` é o incolor — o Wastes não tem cor e não tem pip. */
export interface BasicLand {
  name: string;
  color: ManaColor | null;
  typeLine: string;
}

/** Ordem WUBRG, com o incolor no fim, que é a ordem canónica em Magic. */
export const BASIC_LANDS: BasicLand[] = [
  { name: 'Plains', color: 'W', typeLine: 'Basic Land — Plains' },
  { name: 'Island', color: 'U', typeLine: 'Basic Land — Island' },
  { name: 'Swamp', color: 'B', typeLine: 'Basic Land — Swamp' },
  { name: 'Mountain', color: 'R', typeLine: 'Basic Land — Mountain' },
  { name: 'Forest', color: 'G', typeLine: 'Basic Land — Forest' },
  { name: 'Wastes', color: null, typeLine: 'Basic Land' },
];

/** Um deck não tem 99 ilhas. O tecto do schema é 99; aqui basta muito menos. */
export const MAX_BASIC = 99;

function matches(card: DeckCard, land: BasicLand, board: 'main' | 'side'): boolean {
  return boardOf(card) === board && card.name.trim().toLowerCase() === land.name.toLowerCase();
}

/** Quantos há deste básico. Zero quando não está na lista. */
export function basicLandQuantity(
  cards: DeckCard[] | undefined,
  land: BasicLand,
  board: 'main' | 'side' = 'main',
): number {
  return (cards ?? []).find(card => matches(card, land, board))?.quantity ?? 0;
}

/**
 * Põe a quantidade de um básico no valor dado.
 *
 * Zero **remove a linha** em vez de a deixar a zero: o schema exige `quantity` mínimo de 1, e uma
 * entrada a zero seria um ficheiro que o `npm run validate` chumba.
 */
export function setBasicLandQuantity(
  cards: DeckCard[] | undefined,
  land: BasicLand,
  quantity: number,
  board: 'main' | 'side' = 'main',
): DeckCard[] {
  const list = cards ?? [];
  const wanted = Math.min(Math.max(Math.floor(quantity), 0), MAX_BASIC);

  if (wanted === 0) return list.filter(card => !matches(card, land, board));

  if (list.some(card => matches(card, land, board))) {
    return list.map(card => (matches(card, land, board) ? { ...card, quantity: wanted } : card));
  }

  return [
    ...list,
    {
      name: land.name,
      quantity: wanted,
      board: board === 'side' ? 'side' : undefined,
      typeLine: land.typeLine,
      // Um básico produz a sua cor mas não a tem: `colors` fica vazio de propósito, senão apareciam
      // vinte ilhas a inflacionar a distribuição de cores do deck.
      colors: [],
    },
  ];
}

/** Quantos terrenos básicos há ao todo, para o painel poder mostrar um total. */
export function totalBasics(cards: DeckCard[] | undefined, board: 'main' | 'side' = 'main'): number {
  return BASIC_LANDS.reduce((sum, land) => sum + basicLandQuantity(cards, land, board), 0);
}
