/**
 * Como a app escreve e lê os ficheiros de `data/`.
 *
 * Isto é a fronteira mais frágil de todo o modelo: o telemóvel escreve no repositório, e um ficheiro
 * com a forma errada só dá erro **depois** do commit, no `npm run validate` do CI. Nessa altura já lá
 * está, e a app continua a mandar mais.
 *
 * Por isso os serializadores estão aqui, puros e num sítio só, e o teste ao lado valida o que eles
 * produzem contra o schema verdadeiro em data/schema/. Se o schema mudar e o serializador não, o
 * teste parte antes de alguém dar por isso.
 *
 * Duas regras de forma, para o diff corresponder à alteração e não à formatação: dois espaços de
 * indentação e uma linha em branco no fim, como todos os ficheiros de `data/`; e as chaves sempre
 * pela mesma ordem, que é a ordem do schema.
 */
import type {
  CollectionCard,
  Deck,
  DeckCard,
  Event,
  Game,
  ManaSelection,
  Match,
  Opponent,
  PriceEntry,
  ValueEntry,
} from '../types';

/** Dois espaços e uma linha no fim, como todos os ficheiros de `data/`. */
function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Texto que só vale a pena guardar se tiver alguma coisa lá dentro. */
function trimmed(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

function colors(selection: ManaSelection | undefined): ManaSelection | undefined {
  if (!selection) return undefined;
  if (selection.main.length === 0 && selection.splash.length === 0) return undefined;
  return { main: [...selection.main], splash: [...selection.splash] };
}

function serializeGame(game: Game) {
  return {
    number: game.number,
    result: game.result,
    wentFirst: game.wentFirst,
  };
}

/**
 * Um match como ele vive no ficheiro: sem o nome do adversário.
 *
 * O nome existe num sítio só — `data/taxonomies/opponents.json` — para que corrigi-lo uma vez o
 * corrija em todos os eventos. Guardá-lo também aqui criaria duas verdades que divergem à primeira
 * gralha.
 */
function serializeMatch(match: Match) {
  return {
    round: match.round,
    opponentId: match.opponentId,
    opponentColors: { main: [...match.opponentColors.main], splash: [...match.opponentColors.splash] },
    result: match.result,
    wentFirst: match.wentFirst,
    games: match.games && match.games.length > 0 ? match.games.map(serializeGame) : undefined,
    notes: trimmed(match.notes),
  };
}

export function serializeEvent(event: Event): string {
  // A ordem das chaves é a ordem do schema, de propósito: um ficheiro escrito pelo telemóvel e um
  // ficheiro escrito à mão no computador ficam iguais, e o diff mostra só o que mudou mesmo.
  return serialize({
    id: event.id,
    name: event.name.trim(),
    type: event.type,
    setCode: trimmed(event.setCode),
    date: event.date,
    location: trimmed(event.location),
    status: event.status,
    rank: trimmed(event.rank),
    playersCount: event.playersCount,
    deckId: trimmed(event.deckId),
    deckName: trimmed(event.deckName),
    deckColors: colors(event.deckColors),
    deckThumbnailCardId: trimmed(event.deckThumbnailCardId),
    notes: trimmed(event.notes),
    matches: [...event.matches]
      .sort((a, b) => a.round - b.round)
      .map(serializeMatch),
  });
}

function serializeDeckCard(card: DeckCard) {
  return {
    name: card.name.trim(),
    quantity: card.quantity,
    // `main` é o valor por omissão do schema: escrevê-lo dava ruído em todas as linhas do diff.
    board: card.board === 'side' ? 'side' : undefined,
    scryfallId: trimmed(card.scryfallId),
    manaCost: trimmed(card.manaCost),
    cmc: card.cmc,
    typeLine: trimmed(card.typeLine),
    colors: card.colors && card.colors.length > 0 ? [...card.colors] : undefined,
    artCropUrl: trimmed(card.artCropUrl),
  };
}

/**
 * Um deck, com as cartas por board e depois por nome.
 *
 * A ordem é fixa e não a de introdução: acrescentar uma carta ao deck tem de dar uma linha no diff,
 * não uma lista inteira reordenada.
 */
export function serializeDeck(deck: Deck): string {
  const cards = [...(deck.cards ?? [])].sort((a, b) => {
    const boardA = a.board === 'side' ? 1 : 0;
    const boardB = b.board === 'side' ? 1 : 0;
    return boardA - boardB || a.name.localeCompare(b.name, 'pt');
  });

  return serialize({
    id: deck.id,
    name: deck.name.trim(),
    colors: colors(deck.colors) ?? { main: [], splash: [] },
    format: deck.format,
    archetype: trimmed(deck.archetype),
    thumbnailCardId: trimmed(deck.thumbnailCardId),
    cards: cards.length > 0 ? cards.map(serializeDeckCard) : undefined,
    notes: trimmed(deck.notes),
  });
}

/** Ordenados por nome, para o diff corresponder a quem foi acrescentado e não à ordem dos torneios. */
export function serializeOpponents(opponents: Opponent[]): string {
  const items = [...opponents]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    .map((opponent) => ({
      id: opponent.id,
      name: opponent.name.trim(),
      notes: trimmed(opponent.notes),
    }));

  return serialize({ kind: 'opponents', items });
}

/**
 * A colecção, ordenada por nome e depois por versão.
 *
 * A ordem é fixa e não a de introdução, pela mesma razão dos decks: acrescentar uma carta tem de dar
 * uma linha no diff e não um ficheiro inteiro reordenado.
 */
export function serializeCollection(items: CollectionCard[]): string {
  const sorted = [...items].sort(
    (a, b) =>
      a.name.localeCompare(b.name, 'pt') ||
      (a.setCode ?? '').localeCompare(b.setCode ?? '') ||
      (a.collectorNumber ?? '').localeCompare(b.collectorNumber ?? '') ||
      Number(a.foil ?? false) - Number(b.foil ?? false),
  );

  return serialize({
    kind: 'collection',
    items: sorted.map((card) => ({
      scryfallId: trimmed(card.scryfallId),
      name: card.name.trim(),
      setCode: trimmed(card.setCode),
      collectorNumber: trimmed(card.collectorNumber),
      quantity: card.quantity,
      // `false` é o valor por omissão do schema: escrevê-lo dava ruído em todas as linhas.
      foil: card.foil ? true : undefined,
      condition: card.condition,
      language: trimmed(card.language),
      acquiredAt: trimmed(card.acquiredAt),
      notes: trimmed(card.notes),
    })),
  });
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

/**
 * Um evento vindo de ficheiro, com os nomes dos adversários já resolvidos.
 *
 * Um `opponentId` sem correspondência na taxonomia não deita a app abaixo: mostra o id em vez do
 * nome. É um ficheiro editado à mão a meio, e ver "joao-ferreira" na lista é melhor do que um écran
 * vazio.
 */
export function parseEvent(raw: unknown, namesById: Map<string, string>): Event {
  const data = raw as Event & { matches?: (Match & { opponentId: string })[] };
  return {
    ...data,
    matches: (data.matches ?? []).map((match) => ({
      ...match,
      opponent: namesById.get(match.opponentId) ?? match.opponentId,
    })),
  };
}

export function parseDeck(raw: unknown): Deck {
  const data = raw as Deck;
  return {
    ...data,
    // `colors` é obrigatório no schema, mas um ficheiro editado à mão pode não o ter: um deck sem
    // cores desenha-se sem pips, e é melhor do que a lista de decks não abrir.
    colors: data.colors ?? { main: [], splash: [] },
  };
}

export function parseCollection(raw: unknown): CollectionCard[] {
  const data = raw as { items?: CollectionCard[] };
  return data.items ?? [];
}

/** Os preços vêm do bundle, escritos pelo CI. A app lê-os e nunca lhes toca (ADR 0007). */
export function parsePrices(raw: unknown): PriceEntry[] {
  if (Array.isArray(raw)) return raw as PriceEntry[];
  return ((raw as { items?: PriceEntry[] }).items ?? []);
}

export function parseValueHistory(raw: unknown): ValueEntry[] {
  if (Array.isArray(raw)) return raw as ValueEntry[];
  return ((raw as { entries?: ValueEntry[] }).entries ?? []);
}

export function parseOpponents(raw: unknown): Opponent[] {
  const data = raw as { items?: Opponent[] };
  return data.items ?? [];
}

export function opponentNames(opponents: Opponent[]): Map<string, string> {
  return new Map(opponents.map((opponent) => [opponent.id, opponent.name]));
}
