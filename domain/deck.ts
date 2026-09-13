/**
 * Contas sobre decks. Puro, sem I/O — ver CLAUDE.md § Convenções.
 *
 * Duas coisas diferentes vivem aqui:
 *
 *  1. **Desempenho por deck** — a pergunta que justifica a Fase 2 inteira. Antes disto o deck era
 *     texto livre dentro do evento e não havia forma de somar o que quer que fosse entre torneios.
 *  2. **Análise da lista** — curva de mana, cores e tipos. Funciona sem rede porque os campos que
 *     precisa estão copiados dentro do ficheiro do deck (ver data/schema/deck.schema.json).
 *
 * Nada disto é guardado: calcula-se em runtime, como o win rate dos eventos (CLAUDE.md § Os dados).
 */
import type { Deck, DeckBoard, DeckCard, Event, ManaColor } from '../types';

// ─── Desempenho ──────────────────────────────────────────────────────────────

export interface DeckPerformance {
  deckId: string;
  /** Eventos jogados com este deck. */
  events: number;
  wins: number;
  losses: number;
  draws: number;
  /** 0–100, arredondado. Zero matches dá 0. */
  winRate: number;
}

/**
 * Soma os matches de todos os eventos jogados com um deck.
 *
 * Conta matches e não eventos: dois torneios de três rondas dizem mais do que "dois eventos", e é
 * ao nível do match que a taxa de vitórias significa alguma coisa.
 */
export function deckPerformance(deckId: string, events: Event[]): DeckPerformance {
  const played = events.filter((event) => event.deckId === deckId);

  let wins = 0;
  let losses = 0;
  let draws = 0;

  for (const event of played) {
    for (const match of event.matches) {
      if (match.result === 'W') wins += 1;
      else if (match.result === 'L') losses += 1;
      else draws += 1;
    }
  }

  const total = wins + losses + draws;

  return {
    deckId,
    events: played.length,
    wins,
    losses,
    draws,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
  };
}

/**
 * O desempenho de cada deck, do melhor para o pior.
 *
 * Decks sem nenhum match ficam no fim em vez de ficarem de fora: um deck construído e ainda não
 * jogado é informação, e escondê-lo faria parecer que tinha desaparecido.
 */
export function rankDecks(decks: Deck[], events: Event[]): DeckPerformance[] {
  return decks
    .map((deck) => deckPerformance(deck.id, events))
    .sort((a, b) => {
      const playedA = a.wins + a.losses + a.draws;
      const playedB = b.wins + b.losses + b.draws;
      if (playedA === 0 && playedB === 0) return 0;
      if (playedA === 0) return 1;
      if (playedB === 0) return -1;
      return b.winRate - a.winRate || playedB - playedA;
    });
}

// ─── Análise da lista ────────────────────────────────────────────────────────

/** Só o deck principal conta para a análise: o sideboard não se joga de início. */
function mainboard(cards: DeckCard[]): DeckCard[] {
  return cards.filter((card) => card.board !== 'side');
}

/** Quantas cartas ao todo, contando as quantidades e não as linhas da lista. */
export function cardCount(cards: DeckCard[] | undefined, board?: 'main' | 'side'): number {
  const list = cards ?? [];
  const scoped = board === undefined ? list : list.filter((card) => (card.board ?? 'main') === board);
  return scoped.reduce((total, card) => total + card.quantity, 0);
}

/** `true` se a linha de tipo diz que é um terreno. */
export function isLand(card: DeckCard): boolean {
  return (card.typeLine ?? '').toLowerCase().includes('land');
}

export interface CurveBucket {
  /** Valor de mana. O último balde junta tudo o que custa 7 ou mais. */
  cmc: number;
  /** `true` no balde do 7+, para o eixo poder escrever "7+". */
  isTop: boolean;
  count: number;
}

/** Acima disto as barras deixam de dizer nada e passa a valer mais juntá-las. */
const CURVE_TOP = 7;

/**
 * A curva de mana do deck principal, **sem terrenos**.
 *
 * Os terrenos custam zero e seriam metade do primeiro balde, que é precisamente a barra que se está
 * a tentar ler. É também o que qualquer deck builder faz.
 *
 * Cartas sem `cmc` ficam de fora: foram escritas à mão sem passar pela Scryfall, e inventar zero
 * punha-as todas na barra da esquerda como se fossem grátis.
 */
export function manaCurve(cards: DeckCard[] | undefined): CurveBucket[] {
  const buckets = new Map<number, number>();

  for (const card of mainboard(cards ?? [])) {
    if (isLand(card) || card.cmc === undefined) continue;
    const bucket = Math.min(Math.floor(card.cmc), CURVE_TOP);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + card.quantity);
  }

  if (buckets.size === 0) return [];

  const highest = Math.max(...buckets.keys());
  const result: CurveBucket[] = [];
  for (let cmc = 0; cmc <= highest; cmc += 1) {
    result.push({ cmc, isTop: cmc === CURVE_TOP, count: buckets.get(cmc) ?? 0 });
  }
  return result;
}

export interface ColorSlice {
  color: ManaColor;
  count: number;
}

/**
 * Quantas cartas de cada cor, no deck principal.
 *
 * Uma carta de duas cores conta nas duas — a pergunta é "de quanto de cada cor é que este deck
 * precisa", e não "quantas cartas tenho", que já está no total. Por isso a soma das fatias pode
 * passar o número de cartas, e é suposto.
 */
export function colorDistribution(cards: DeckCard[] | undefined): ColorSlice[] {
  const counts = new Map<ManaColor, number>();

  for (const card of mainboard(cards ?? [])) {
    for (const color of card.colors ?? []) {
      counts.set(color, (counts.get(color) ?? 0) + card.quantity);
    }
  }

  const order: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];
  return order
    .filter((color) => (counts.get(color) ?? 0) > 0)
    .map((color) => ({ color, count: counts.get(color)! }));
}

/**
 * Tipos por ordem de quem manda quando uma carta tem mais do que um.
 *
 * Um "Artifact Creature" conta como criatura: é o que ela faz em jogo, e é assim que qualquer
 * lista de deck a apresenta.
 */
const TYPE_PRIORITY = [
  'Creature',
  'Planeswalker',
  'Battle',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Land',
] as const;

export type CardType = (typeof TYPE_PRIORITY)[number] | 'Other';

/** O tipo que manda numa linha de tipo. `null` quando não há linha para ler. */
export function primaryType(card: DeckCard): CardType | null {
  const line = card.typeLine;
  if (!line) return null;

  // Só interessa o que está antes do travessão: depois vêm os subtipos (Human Wizard), que não são
  // tipos. O travessão da Scryfall é um em dash, mas um ficheiro escrito à mão pode trazer um hífen.
  const beforeDash = line.split(/[—–-]/)[0];

  for (const type of TYPE_PRIORITY) {
    if (new RegExp(`\\b${type}\\b`, 'i').test(beforeDash)) return type;
  }
  return 'Other';
}

export interface TypeCount {
  type: CardType;
  count: number;
}

/**
 * Contagem por tipo do deck principal, do mais comum para o menos.
 *
 * Ao contrário da curva, os terrenos **entram**: saber que um deck leva 24 terrenos é metade da
 * leitura de uma lista.
 */
export function typeCounts(cards: DeckCard[] | undefined): TypeCount[] {
  const counts = new Map<CardType, number>();

  for (const card of mainboard(cards ?? [])) {
    const type = primaryType(card);
    if (type === null) continue;
    counts.set(type, (counts.get(type) ?? 0) + card.quantity);
  }

  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

export interface SubtypeCount {
  subtype: string;
  count: number;
  /** 0–100, arredondado a uma casa. Ver a nota sobre o denominador. */
  percent: number;
}

/** Acima disto a lista deixa de se ler e o resto vale mais somado em "Other". */
const SUBTYPE_LIMIT = 5;

/**
 * Os subtipos mais comuns do deck principal, para um tipo de carta.
 *
 * Um subtipo é o que vem **depois** do travessão na linha de tipo: "Legendary Creature — Human
 * Wizard" dá `Human` e `Wizard`. O `primaryType` já parte a linha nesse sítio e deita fora este
 * lado; aqui aproveita-se.
 *
 * Uma carta com dois subtipos conta nos dois, como acontece com as cores. **A percentagem é sobre o
 * total de subtipos contados, não sobre o número de cartas** — com 14 criaturas a somarem 26
 * subtipos, 5 Wizards são 19% de 26 e não 36% de 14. É também assim que a app de referência o faz
 * (ver design/referencia-manabox/).
 */
export function subtypeCounts(
  cards: DeckCard[] | undefined,
  type: CardType = 'Creature',
  limit: number = SUBTYPE_LIMIT,
): SubtypeCount[] {
  const counts = new Map<string, number>();
  let total = 0;

  for (const card of mainboard(cards ?? [])) {
    if (primaryType(card) !== type) continue;

    const line = card.typeLine ?? '';
    const dash = line.search(/[—–-]/);
    if (dash === -1) continue;

    for (const word of line.slice(dash + 1).trim().split(/\s+/)) {
      const subtype = word.trim();
      if (!subtype) continue;
      counts.set(subtype, (counts.get(subtype) ?? 0) + card.quantity);
      total += card.quantity;
    }
  }

  if (total === 0) return [];

  const ordered = [...counts.entries()]
    .map(([subtype, count]) => ({ subtype, count }))
    .sort((a, b) => b.count - a.count || a.subtype.localeCompare(b.subtype));

  const top = ordered.slice(0, limit);
  const rest = ordered.slice(limit).reduce((sum, entry) => sum + entry.count, 0);

  const pct = (count: number) => Math.round((count / total) * 1000) / 10;

  const result: SubtypeCount[] = top.map(entry => ({ ...entry, percent: pct(entry.count) }));
  if (rest > 0) result.push({ subtype: 'Other', count: rest, percent: pct(rest) });
  return result;
}

/**
 * A decklist agrupada por tipo, na ordem em que os tipos aparecem em `typeCounts`.
 *
 * É o que a lista do deck mostra: um cabeçalho por tipo com a contagem à frente. Cartas sem linha
 * de tipo — escritas à mão — ficam num grupo próprio no fim, em vez de desaparecerem.
 */
export function groupByType(cards: DeckCard[] | undefined, board: DeckBoard = 'main'): {
  type: CardType | 'Unknown';
  count: number;
  cards: DeckCard[];
}[] {
  const scoped = (cards ?? []).filter(card => (card.board ?? 'main') === board);

  const groups = new Map<CardType | 'Unknown', DeckCard[]>();
  for (const card of scoped) {
    const key = primaryType(card) ?? 'Unknown';
    groups.set(key, [...(groups.get(key) ?? []), card]);
  }

  return [...groups.entries()]
    .map(([type, list]) => ({
      type,
      count: list.reduce((sum, card) => sum + card.quantity, 0),
      cards: [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    }))
    .sort((a, b) => {
      // "Unknown" no fim; o resto pela contagem, como a referência.
      if (a.type === 'Unknown') return 1;
      if (b.type === 'Unknown') return -1;
      return b.count - a.count || a.type.localeCompare(b.type);
    });
}

/**
 * Se vale a pena mostrar o analisador.
 *
 * Um deck sem cartas, ou com cartas escritas à mão sem `cmc` nem `typeLine`, não dá gráfico nenhum —
 * e um écran com três gráficos vazios é pior do que não haver écran.
 */
export function canAnalyse(deck: Deck): boolean {
  return manaCurve(deck.cards).length > 0 || typeCounts(deck.cards).length > 0;
}

// ─── Decks que ficam e decks que passam ───────────────────────────────────────

/**
 * Um deck que existiu para um evento só.
 *
 * Em Sealed e Draft o deck constrói-se no torneio com as cartas que saíram das boosters, joga-se
 * nesse dia e desfaz-se. **Continua a valer a pena guardá-lo** — é dele que sai o registo de como
 * correu, e a decklist que se fotografou — mas não pertence à mesma lista de um deck de Modern que
 * se afina durante meses. Um Sealed por mês soterrava os decks a sério ao fim de um ano.
 *
 * A regra é o formato e mais nada: não há campo novo no ficheiro, e um deck muda de secção sozinho
 * se lhe corrigirem o formato.
 */
export function isEventDeck(deck: Deck): boolean {
  return deck.format === 'Sealed' || deck.format === 'Draft';
}

/**
 * Separa os decks em dois grupos, preservando a ordem de cada um.
 *
 * A ordem que chega é a que interessa (o ranking por desempenho, tipicamente) e não se mexe nela —
 * só se parte a lista em duas.
 */
export function splitByPurpose<T extends { deck: Deck }>(entries: T[]): { kept: T[]; oneOff: T[] } {
  return {
    kept: entries.filter(entry => !isEventDeck(entry.deck)),
    oneOff: entries.filter(entry => isEventDeck(entry.deck)),
  };
}
