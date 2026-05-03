// Dados mock para desenvolvimento — substituir por chamadas Supabase na Fase 2
// Reflecte os eventos mostrados nos designs (design/screen-events.png, screen-event-detail.png)

import { Event } from '../types';

export const mockEvents: Event[] = [
  {
    id: '1',
    name: 'FNM Sealed — Aetherdrift',
    type: 'Sealed',
    date: '2026-04-12',
    location: 'Nave Espacial, Lisboa',
    active: true,
    deckName: 'Selesnya Midrange',
    deckColors: { main: ['G', 'W'], splash: ['U'] },
    matches: [
      { id: 'm1', round: 1, opponent: 'João Ferreira',   opponentColors: { main: ['U', 'B'], splash: [] },      result: 'W', createdAt: '2026-04-12' },
      { id: 'm2', round: 2, opponent: 'Miguel Soares',   opponentColors: { main: ['R', 'G'], splash: [] },      result: 'W', createdAt: '2026-04-12' },
      { id: 'm3', round: 3, opponent: 'Ana Costa',       opponentColors: { main: ['W', 'U'], splash: ['B'] },   result: 'D', createdAt: '2026-04-12' },
      { id: 'm4', round: 4, opponent: 'Tiago Mendes',    opponentColors: { main: ['B', 'R'], splash: [] },      result: 'W', createdAt: '2026-04-12' },
      { id: 'm5', round: 5, opponent: 'Rui Almeida',     opponentColors: { main: ['G'],      splash: ['W'] },   result: 'W', createdAt: '2026-04-12' },
    ],
  },
  {
    id: '2',
    name: 'PTQ Trial Draft',
    type: 'Draft',
    date: '2026-04-05',
    active: false,
    deckColors: { main: ['U', 'R'], splash: [] },
    matches: [
      { id: 'm6',  round: 1, opponent: 'Carlos Silva',    opponentColors: { main: ['G', 'W'], splash: [] },  result: 'W', createdAt: '2026-04-05' },
      { id: 'm7',  round: 2, opponent: 'Pedro Martins',   opponentColors: { main: ['B'],      splash: ['U'] }, result: 'L', createdAt: '2026-04-05' },
      { id: 'm8',  round: 3, opponent: 'Inês Rodrigues',  opponentColors: { main: ['U', 'W'], splash: [] },  result: 'W', createdAt: '2026-04-05' },
    ],
  },
  {
    id: '3',
    name: 'LGS Sealed League Rd. 3',
    type: 'Sealed',
    date: '2026-03-28',
    active: false,
    deckColors: { main: ['G', 'B'], splash: ['R'] },
    matches: [
      { id: 'm9',  round: 1, opponent: 'André Santos',    opponentColors: { main: ['W', 'B'], splash: [] },  result: 'W', createdAt: '2026-03-28' },
      { id: 'm10', round: 2, opponent: 'Sofia Lima',      opponentColors: { main: ['R', 'G'], splash: [] },  result: 'W', createdAt: '2026-03-28' },
      { id: 'm11', round: 3, opponent: 'Rui Costa',       opponentColors: { main: ['U'],      splash: ['B'] }, result: 'W', createdAt: '2026-03-28' },
      { id: 'm12', round: 4, opponent: 'Marta Oliveira',  opponentColors: { main: ['W', 'U'], splash: [] },  result: 'W', createdAt: '2026-03-28' },
      { id: 'm13', round: 5, opponent: 'Diogo Ferreira',  opponentColors: { main: ['B', 'R'], splash: [] },  result: 'L', createdAt: '2026-03-28' },
    ],
  },
  {
    id: '4',
    name: 'Store Draft Championship',
    type: 'Draft',
    date: '2026-03-15',
    active: false,
    deckColors: { main: ['W', 'G'], splash: [] },
    matches: [
      { id: 'm14', round: 1, opponent: 'Filipe Carvalho', opponentColors: { main: ['U', 'R'], splash: [] },      result: 'W', createdAt: '2026-03-15' },
      { id: 'm15', round: 2, opponent: 'Beatriz Sousa',   opponentColors: { main: ['B', 'G'], splash: [] },      result: 'W', createdAt: '2026-03-15' },
      { id: 'm16', round: 3, opponent: 'Nuno Pereira',    opponentColors: { main: ['R', 'W'], splash: ['G'] },   result: 'W', createdAt: '2026-03-15' },
    ],
  },
  {
    id: '5',
    name: 'Saturday Sealed',
    type: 'Sealed',
    date: '2026-03-07',
    active: false,
    deckColors: { main: ['U', 'B'], splash: [] },
    matches: [
      { id: 'm17', round: 1, opponent: 'Gonçalo Monteiro', opponentColors: { main: ['R', 'G'], splash: [] },  result: 'W', createdAt: '2026-03-07' },
      { id: 'm18', round: 2, opponent: 'Catarina Alves',   opponentColors: { main: ['W', 'U'], splash: [] },  result: 'L', createdAt: '2026-03-07' },
      { id: 'm19', round: 3, opponent: 'Luís Neves',       opponentColors: { main: ['B'],      splash: ['R'] }, result: 'W', createdAt: '2026-03-07' },
    ],
  },
];

// Utilitários sobre mock data
export const activeEvent = mockEvents.find(e => e.active) ?? null;
export const pastEvents  = mockEvents.filter(e => !e.active);
