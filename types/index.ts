// Tipos TypeScript — MTG Recall
// Fonte de verdade: design/handoff.md § 7

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G';
export type MatchResult = 'W' | 'L' | 'D';
export type EventType =
  | 'Sealed'
  | 'Draft'
  | 'Standard'
  | 'Modern'
  | 'Legacy'
  | 'Pioneer'
  | 'Commander';

// Cores de um deck ou adversário, com distinção principal/splash
export interface ManaSelection {
  main: ManaColor[];
  splash: ManaColor[];
}

// Um match individual dentro de um evento
export interface Match {
  id: string;
  round: number;           // calculado: índice na lista + 1
  opponent: string;
  opponentColors: ManaSelection;
  result: MatchResult;
  notes?: string;
  createdAt: string;       // ISO date string
}

// Um evento/torneio
export interface Event {
  id: string;
  name: string;
  type: EventType;
  date: string;            // ISO date string (permite datas retroactivas)
  location?: string;
  active: boolean;         // torneio em curso
  deckName?: string;       // Fase 2+
  deckColors?: ManaSelection;        // Fase 2+
  deckThumbnailCardId?: string;      // Fase 3+ (Scryfall card ID)
  rank?: string;           // ex: "1º lugar", "Top 8"
  playersCount?: number;
  matches: Match[];
  // Campos calculados — NÃO guardar na DB, calcular em runtime:
  // wins, losses, draws, winRate, points, rank
}

// Campos calculados derivados de um Event
export interface EventStats {
  wins: number;
  losses: number;
  draws: number;
  winRate: number;    // 0–100
  points: number;     // W*3 + D*1
}

// Calcula stats de um evento a partir dos matches
export function calcEventStats(event: Event): EventStats {
  const wins   = event.matches.filter(m => m.result === 'W').length;
  const losses = event.matches.filter(m => m.result === 'L').length;
  const draws  = event.matches.filter(m => m.result === 'D').length;
  const total  = wins + losses + draws;
  return {
    wins,
    losses,
    draws,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    points:  wins * 3 + draws,
  };
}
