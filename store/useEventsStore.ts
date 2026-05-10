// Store global de eventos — Zustand
// Fonte de verdade durante a sessão.
// Acções chamam os services do Supabase e actualizam o estado local.
//
// Acções disponíveis:
//   loadEvents()              — carrega eventos do Supabase (chamar no mount)
//   addMatch(eventId, data)   — cria match no Supabase + actualiza lista local
//   createEvent(data)         — cria evento no Supabase + adiciona à lista local

import { create } from 'zustand';
import { Event, ManaSelection, MatchResult, EventType } from '../types';
import { fetchEvents, createEvent as serviceCreateEvent, deleteEvent as serviceDeleteEvent, NewEventData } from '../services/events';
import { createMatch as serviceCreateMatch, deleteMatch as serviceDeleteMatch, NewMatchData } from '../services/matches';

interface EventsStore {
  events:    Event[];
  isLoading: boolean;

  // Carrega todos os eventos do utilizador a partir do Supabase
  loadEvents: () => Promise<void>;

  // Adiciona um match a um evento (persiste no Supabase)
  addMatch: (eventId: string, data: NewMatchData) => Promise<void>;

  // Cria um novo evento (persiste no Supabase); devolve o ID do evento criado
  createEvent: (data: NewEventData) => Promise<string | null>;

  // Apaga um evento e todos os seus matches
  deleteEvent: (eventId: string) => Promise<boolean>;

  // Apaga um match de um evento
  deleteMatch: (eventId: string, matchId: string) => Promise<boolean>;
}

export const useEventsStore = create<EventsStore>((set, get) => ({
  events:    [],
  isLoading: false,

  // ─── loadEvents ────────────────────────────────────────────────────────────

  loadEvents: async () => {
    set({ isLoading: true });
    const events = await fetchEvents();
    set({ events, isLoading: false });
  },

  // ─── addMatch ──────────────────────────────────────────────────────────────

  addMatch: async (eventId, data) => {
    const event = get().events.find(e => e.id === eventId);
    if (!event) return;

    const round = event.matches.length + 1;
    const match = await serviceCreateMatch(eventId, round, data);
    if (!match) return;

    // Actualiza o estado local com o match devolvido pelo Supabase
    set(state => ({
      events: state.events.map(e =>
        e.id === eventId
          ? { ...e, matches: [...e.matches, match] }
          : e,
      ),
    }));
  },

  // ─── createEvent ───────────────────────────────────────────────────────────

  createEvent: async (data) => {
    const event = await serviceCreateEvent(data);
    if (!event) return null;

    set(state => ({ events: [event, ...state.events] }));
    return event.id;
  },

  // ─── deleteEvent ───────────────────────────────────────────────────────────

  deleteEvent: async (eventId) => {
    const ok = await serviceDeleteEvent(eventId);
    if (!ok) return false;

    set(state => ({
      events: state.events.filter(e => e.id !== eventId),
    }));
    return true;
  },

  // ─── deleteMatch ───────────────────────────────────────────────────────────

  deleteMatch: async (eventId, matchId) => {
    const ok = await serviceDeleteMatch(matchId);
    if (!ok) return false;

    // Remove o match e renumera as rondas para manter sequência correcta
    set(state => ({
      events: state.events.map(e => {
        if (e.id !== eventId) return e;
        const filtered = e.matches.filter(m => m.id !== matchId);
        const renumbered = filtered.map((m, i) => ({ ...m, round: i + 1 }));
        return { ...e, matches: renumbered };
      }),
    }));
    return true;
  },
}));
