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
import type { CardRarity, DeckCard, ManaColor } from '../types';
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

// ─── A colecção dos básicos vem do próprio deck ──────────────────────────────

/**
 * A fatia mínima para uma colecção ser "a colecção do deck".
 *
 * É **mais de metade**, à letra. Um Sealed ou um Draft saem todos da mesma colecção e passam com
 * folga; um Commander com cartas de trinta colecções não passa nenhuma — e é isso que se quer.
 * Escolher a colecção "mais representada" de um Commander seria escolher quatro cartas em noventa e
 * nove e fingir que isso queria dizer alguma coisa.
 *
 * Ser maioria absoluta resolve também os empates sem regra nenhuma à parte: dois conjuntos a 50%
 * não dão maioria a ninguém, e portanto não há desempate arbitrário para inventar.
 */
export const DOMINANT_SET_SHARE = 0.5;

/**
 * A colecção de onde vem a maior parte das cartas do deck, se houver uma.
 *
 * Serve para dar aos terrenos básicos a arte da colecção que se jogou: um Sealed de uma colecção
 * fica com os básicos dessa colecção, que é o que está mesmo dentro da caixa.
 *
 * Conta **por quantidade** e não por linha: quatro cópias da mesma carta pesam quatro. E conta só
 * o que tem `setCode` — os básicos não têm, e portanto não votam na sua própria colecção.
 */
export function dominantSetCode(cards: DeckCard[] | undefined): string | undefined {
  const weight = new Map<string, number>();
  let total = 0;

  for (const card of cards ?? []) {
    const code = card.setCode?.trim().toLowerCase();
    if (!code) continue;

    const quantity = Math.max(1, Math.floor(card.quantity) || 1);
    weight.set(code, (weight.get(code) ?? 0) + quantity);
    total += quantity;
  }

  if (total === 0) return undefined;

  let best: string | undefined;
  let bestWeight = 0;
  for (const [code, quantity] of weight) {
    if (quantity > bestWeight) {
      best = code;
      bestWeight = quantity;
    }
  }

  return best !== undefined && bestWeight > total * DOMINANT_SET_SHARE ? best : undefined;
}

/** O básico com este nome, se for um. Serve para normalizar a grafia — "island" vira "Island". */
export function basicLandNamed(name: string): BasicLand | undefined {
  const wanted = name.trim().toLowerCase();
  return BASIC_LANDS.find(land => land.name.toLowerCase() === wanted);
}

/**
 * Os básicos deste deck que ainda não têm arte nenhuma, sem repetições.
 *
 * Um básico a que alguém tenha escolhido uma impressão à mão (tem `scryfallId`) fica de fora: a
 * escolha de quem lá pôs a carta ganha sempre à colecção que o deck sugere.
 */
export function basicLandsToIllustrate(cards: DeckCard[] | undefined): string[] {
  const names: string[] = [];

  for (const card of cards ?? []) {
    if (card.scryfallId || card.artCropUrl) continue;

    const land = basicLandNamed(card.name);
    if (land && !names.includes(land.name)) names.push(land.name);
  }

  return names;
}

/** O que uma impressão empresta a um básico. É um subconjunto de `ScryfallCard` de propósito. */
export interface BasicLandPrinting {
  scryfallId: string;
  setCode?: string;
  rarity?: CardRarity;
  artCropUrl?: string;
}

/**
 * Empresta aos básicos a arte da colecção do deck.
 *
 * **Não altera o ficheiro do deck** e é para ser usado só no que se desenha. A colecção dominante é
 * um campo calculado — muda quando o deck muda — e campos calculados não vão para os ficheiros
 * (CLAUDE.md, § Os dados). Gravá-la também congelava a escolha: um deck que trocasse de cartas
 * ficava com os básicos da colecção antiga.
 *
 * `colors` fica como está — vazio. Um básico produz a sua cor mas não a tem, e vinte ilhas com cor
 * inflacionariam a distribuição de cores do deck.
 */
export function withBasicLandArt(
  cards: DeckCard[] | undefined,
  printings: Map<string, BasicLandPrinting>,
): DeckCard[] {
  const list = cards ?? [];
  if (printings.size === 0) return list;

  return list.map(card => {
    if (card.scryfallId || card.artCropUrl) return card;

    const land = basicLandNamed(card.name);
    const printing = land && printings.get(land.name.toLowerCase());
    if (!printing) return card;

    return {
      ...card,
      scryfallId: printing.scryfallId,
      setCode: printing.setCode,
      rarity: printing.rarity,
      artCropUrl: printing.artCropUrl,
    };
  });
}
