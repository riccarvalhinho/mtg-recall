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
  /** Referência a data/taxonomies/opponents.json. É isto que vai para o ficheiro. */
  opponentId: string;
  /** Nome resolvido a partir da taxonomia, para a interface. Nunca é guardado no evento. */
  opponent: string;
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
  deckName?: string;
  deckColors?: ManaSelection;
  /** Scryfall id da carta que ilustra o deck — Fase 3. */
  deckThumbnailCardId?: string;
  notes?: string;
  matches: Match[];
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
