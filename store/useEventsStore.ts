// Store global de eventos — Zustand
// Fonte de verdade durante a sessão. Substituir por Supabase na Fase 2.
//
// Acções disponíveis:
//   addMatch(eventId, matchData)  — adiciona match a um evento
//   addEvent(eventData)           — cria novo evento (TODO Fase 2)

import { create } from 'zustand';
import { Event, Match, ManaSelection, MatchResult } from '../types';
import { mockEvents } from '../data/mock';

interface NewMatchData {
  opponent: string;
  opponentColors: ManaSelection;
  result: MatchResult;
  notes?: string;
}

interface EventsStore {
  events: Event[];
  addMatch: (eventId: string, data: NewMatchData) => void;
  // TODO Fase 2: addEvent, updateEvent, deleteEvent (via Supabase)
}

export const useEventsStore = create<EventsStore>((set) => ({
  // Estado inicial: mock data (substituir por query Supabase na Fase 2)
  events: mockEvents,

  addMatch: (eventId, data) =>
    set((state) => ({
      events: state.events.map((event) => {
        if (event.id !== eventId) return event;

        const newMatch: Match = {
          id: Date.now().toString(),
          round: event.matches.length + 1,
          opponent: data.opponent,
          opponentColors: data.opponentColors,
          result: data.result,
          notes: data.notes,
          createdAt: new Date().toISOString(),
        };

        return { ...event, matches: [...event.matches, newMatch] };
      }),
    })),
}));
