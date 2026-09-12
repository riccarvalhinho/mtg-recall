/**
 * Contas sobre a colecção. Puro, sem I/O — ver CLAUDE.md § Convenções.
 *
 * É partilhado entre a app (que mostra o valor) e o `tools/refresh-prices.mts` (que o escreve no
 * histórico). Ter as duas contas no mesmo sítio é o que garante que o número no telemóvel e o número
 * no ficheiro são o mesmo número.
 */
import type { CollectionCard, PriceEntry } from '../types';

/**
 * O preço de uma carta, já a escolher entre foil e normal.
 *
 * `null` quando não se sabe — e não zero. Uma carta sem preço conhecido não vale zero euros, vale
 * um valor que não temos, e somá-la como zero fazia uma colecção parecer mais pobre do que é sem
 * dizer porquê.
 */
export function priceOf(card: CollectionCard, prices: Map<string, PriceEntry>): number | null {
  if (!card.scryfallId) return null;

  const entry = prices.get(card.scryfallId);
  if (!entry) return null;

  const value = card.foil ? entry.eurFoil : entry.eur;
  return value ?? null;
}

export interface CollectionValue {
  /** Valor total em euros, já a contar quantidades. */
  totalEur: number;
  /** Quantas cartas há ao todo, contando quantidades. */
  cards: number;
  /** Quantas dessas tinham preço conhecido. */
  priced: number;
}

/**
 * O valor da colecção inteira.
 *
 * Devolve `priced` ao lado do total de propósito: um total calculado sobre metade da colecção é um
 * número diferente de um total calculado sobre toda ela, e a interface tem de o poder dizer em vez
 * de apresentar os dois como se fossem iguais.
 */
export function collectionValue(
  items: CollectionCard[],
  prices: Map<string, PriceEntry>,
): CollectionValue {
  let totalEur = 0;
  let cards = 0;
  let priced = 0;

  for (const card of items) {
    cards += card.quantity;

    const price = priceOf(card, prices);
    if (price === null) continue;

    totalEur += price * card.quantity;
    priced += card.quantity;
  }

  // Cêntimos: somar floats dá 12.100000000000001, e isso ia parar a um ficheiro versionado.
  return { totalEur: Math.round(totalEur * 100) / 100, cards, priced };
}

/** Um índice por `scryfallId`, que é como o resto do módulo espera receber os preços. */
export function priceIndex(entries: PriceEntry[]): Map<string, PriceEntry> {
  return new Map(entries.map((entry) => [entry.scryfallId, entry]));
}

/**
 * Os ids de impressão que vale a pena pedir à Scryfall.
 *
 * Sem duplicados, e sem as cartas que só têm nome: uma carta sem `scryfallId` não tem preço
 * possível, porque não se sabe de que impressão se está a falar (ADR 0007).
 */
export function pricedIds(items: CollectionCard[]): string[] {
  const ids = new Set<string>();
  for (const card of items) {
    if (card.scryfallId) ids.add(card.scryfallId);
  }
  return [...ids];
}

/**
 * As cartas mais valiosas primeiro.
 *
 * Ordena pelo valor da pilha (preço × quantidade) e não pelo preço unitário: vinte cópias de uma
 * carta de dois euros pesam mais na colecção do que uma de trinta.
 */
export function byValueDesc(
  items: CollectionCard[],
  prices: Map<string, PriceEntry>,
): { card: CollectionCard; stackEur: number | null }[] {
  return items
    .map((card) => {
      const price = priceOf(card, prices);
      return { card, stackEur: price === null ? null : Math.round(price * card.quantity * 100) / 100 };
    })
    .sort((a, b) => (b.stackEur ?? -1) - (a.stackEur ?? -1));
}

/**
 * Acrescenta uma medição ao histórico, substituindo a do mesmo dia se já existir.
 *
 * Correr o workflow duas vezes no mesmo dia não deve dar duas entradas: o que interessa é o valor
 * naquele dia, e a segunda medição é simplesmente mais recente do que a primeira.
 */
export function appendValueEntry<T extends { date: string }>(entries: T[], entry: T): T[] {
  const withoutToday = entries.filter((existing) => existing.date !== entry.date);
  return [...withoutToday, entry].sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Ligar uma carta escrita à mão a uma impressão ────────────────────────────

/**
 * Uma carta escrita à mão, sem impressão concreta atrás.
 *
 * Sem `scryfallId` não há preço possível (ADR 0007): a Scryfall cobra os preços por impressão, e
 * "Lightning Bolt" sozinho não diz qual das dezenas de impressões está na caixa. O nome continua a
 * ser o caminho que nunca falha para acrescentar uma carta sem rede — isto é só a forma de o
 * completar mais tarde, com sinal.
 */
export function needsPrinting(card: CollectionCard): boolean {
  return !card.scryfallId;
}

/**
 * A mesma carta, agora apontada a uma impressão concreta.
 *
 * O que o utilizador escreveu sobre a cópia que tem — quantidade, condição, foil, idioma, data de
 * aquisição, notas — sobrevive. O que muda é a identidade da impressão, e o nome, que passa a ser o
 * da Scryfall: se ele escreveu "Lighting Bolt" com uma gralha, a gralha ia ficar lá para sempre.
 */
export function withPrinting(
  card: CollectionCard,
  printing: { scryfallId: string; name: string; setCode?: string; collectorNumber?: string },
): CollectionCard {
  return {
    ...card,
    scryfallId: printing.scryfallId,
    name: printing.name.trim(),
    setCode: printing.setCode ?? card.setCode,
    collectorNumber: printing.collectorNumber ?? card.collectorNumber,
  };
}
