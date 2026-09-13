// Tipos TypeScript — MTG Recall
//
// Derivam dos schemas em data/schema/, não o contrário: mudar um campo é mudar o schema primeiro e
// só depois este ficheiro (ver CLAUDE.md § Convenções). O que está aqui é a forma em memória; a
// forma em ficheiro está em services/repoFiles.ts, e a diferença entre as duas é uma só — o nome do
// adversário, que em memória vem resolvido e em ficheiro é uma referência.

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G';
export type MatchResult = 'W' | 'L' | 'D';

/** Um game não empata: ou se ganha ou se perde. O empate só existe ao nível do match. */
export type GameResult = 'W' | 'L';

export type EventType =
  | 'Sealed'
  | 'Draft'
  | 'Standard'
  | 'Modern'
  | 'Pioneer'
  | 'Legacy'
  | 'Commander';

/** Um torneio a decorrer está `active`. Só deve haver um de cada vez. */
export type EventStatus = 'active' | 'completed';

// Cores de um deck ou adversário, com distinção principal/splash
export interface ManaSelection {
  main: ManaColor[];
  splash: ManaColor[];
}

// Um game individual dentro de um match — permite saber que um 2-1 foi 2-1
export interface Game {
  number: number;
  result: GameResult;
  wentFirst?: boolean;
}

// Um match individual dentro de um evento
export interface Match {
  /** Identifica o match dentro do evento. Sequencial a partir de 1 — não há ids. */
  round: number;
  /**
   * Referência a data/taxonomies/opponents.json. É isto que vai para o ficheiro.
   *
   * Ausente quando não se registou adversário — um torneio antigo carregado de memória. Ausente é
   * diferente de uma pessoa chamada "Unknown": sem id, o match não entra nas contas por adversário,
   * que é o que impede a lista de ser encabeçada por alguém que não existe.
   */
  opponentId?: string;
  /** Nome resolvido a partir da taxonomia, para a interface. Nunca é guardado no evento. */
  opponent?: string;
  opponentColors: ManaSelection;
  result: MatchResult;
  /** true se fui eu a jogar primeiro. */
  wentFirst?: boolean;
  games?: Game[];
  notes?: string;
}

// Um evento/torneio
export interface Event {
  /** Slug com a data à frente, igual ao nome do ficheiro: 2026-04-12-fnm-sealed-aetherdrift */
  id: string;
  name: string;
  type: EventType;
  /** Código Scryfall do set — só faz sentido em Limited. */
  setCode?: string;
  /** Dia do torneio, AAAA-MM-DD. Pode ser retroactivo. */
  date: string;
  location?: string;
  status: EventStatus;
  /** Classificação final, introduzida à mão (ex.: "1st", "Top 8"). */
  rank?: string;
  playersCount?: number;
  /** Referência a `data/decks/<id>.json`. Quando existe, manda sobre deckName/deckColors. */
  deckId?: string;
  /** Legado: eventos anteriores à Fase 2 só têm isto. Continuam a ler-se. */
  deckName?: string;
  /** Legado, como o deckName. */
  deckColors?: ManaSelection;
  /** Scryfall id da carta que ilustra o deck — Fase 3. */
  deckThumbnailCardId?: string;
  notes?: string;
  matches: Match[];
}

// ─── Decks ───────────────────────────────────────────────────────────────────

/** Deck principal ou sideboard. Ausente no ficheiro significa `main`. */
export type DeckBoard = 'main' | 'side';

/**
 * Uma entrada da lista de cartas.
 *
 * Os campos vindos da Scryfall são copiados para o ficheiro de propósito: os dados de uma impressão
 * não mudam, e copiá-los deixa o Deck Analyser funcionar sem rede (regra 3). O que muda com o tempo
 * são os preços, e esses ficam de fora — Fase 4.
 */
export interface DeckCard {
  name: string;
  quantity: number;
  board?: DeckBoard;
  scryfallId?: string;
  manaCost?: string;
  cmc?: number;
  typeLine?: string;
  colors?: ManaColor[];
  /**
   * Recorte da arte. É a imagem que a decklist mostra — nunca a carta inteira, que a esse tamanho
   * seria moldura e texto ilegível. Não é imutável como os outros campos copiados: se falhar a
   * carregar, a linha volta ao placeholder.
   */
  artCropUrl?: string;
}

/** Um deck. Um ficheiro por deck em `data/decks/<id>.json`. */
export interface Deck {
  /** Slug, igual ao nome do ficheiro. */
  id: string;
  name: string;
  colors: ManaSelection;
  format?: EventType;
  archetype?: string;
  thumbnailCardId?: string;
  /** Opcional: um deck sem cartas já serve para saber com que deck se ganha mais. */
  cards?: DeckCard[];
  notes?: string;
}

// ─── Colecção e preços ───────────────────────────────────────────────────────

/** Estado da carta, na escala da Cardmarket. Ausente = não registado, não "impecável". */
export type CardCondition = 'M' | 'NM' | 'EX' | 'GD' | 'LP' | 'PL' | 'PO';

/** Uma carta que o autor tem. Ver data/schema/collection.schema.json. */
export interface CollectionCard {
  /** Id da impressão concreta. Sem isto não há preço possível — ver ADR 0007. */
  scryfallId?: string;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  quantity: number;
  /** Ausente = não-foil. Ter as duas versões são duas entradas. */
  foil?: boolean;
  condition?: CardCondition;
  /** Código de idioma da Scryfall. Ausente = inglês. */
  language?: string;
  acquiredAt?: string;
  notes?: string;
}

/**
 * O preço de uma impressão, em euros.
 *
 * Vive à parte da colecção (ADR 0007) e é escrito por um workflow agendado, nunca pelo telemóvel.
 * Os campos são opcionais porque a Scryfall nem sempre tem preço — e ausente é diferente de zero.
 */
export interface PriceEntry {
  scryfallId: string;
  eur?: number;
  eurFoil?: number;
}

/** Uma medição do valor da colecção num dia. Append-only — ver ADR 0007. */
export interface ValueEntry {
  date: string;
  totalEur: number;
  cards: number;
  priced?: number;
}

// Um adversário na taxonomia
export interface Opponent {
  id: string;
  name: string;
  notes?: string;
}

// Campos calculados derivados de um Event — nunca guardados
export interface EventStats {
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // 0–100
  points: number; // W*3 + D*1
}

// Calcula stats de um evento a partir dos matches
export function calcEventStats(event: Event): EventStats {
  const wins = event.matches.filter(m => m.result === 'W').length;
  const losses = event.matches.filter(m => m.result === 'L').length;
  const draws = event.matches.filter(m => m.result === 'D').length;
  const total = wins + losses + draws;
  return {
    wins,
    losses,
    draws,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    points: wins * 3 + draws,
  };
}

/** Um evento a decorrer. Existe para não haver dez sítios a comparar strings. */
export function isActive(event: Event): boolean {
  return event.status === 'active';
}
