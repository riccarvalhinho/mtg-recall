// services/events.ts — CRUD de eventos via Supabase
// Chamado pelo store (store/useEventsStore.ts) — nunca directamente pelos écrans

import { supabase } from './supabase';
import { Event, EventType, ManaSelection } from '../types';

// ─── Helpers de conversão DB → TypeScript ────────────────────────────────────

// Converte uma linha da DB (com matches aninhados) para o tipo Event da app
function dbRowToEvent(row: any): Event {
  return {
    id:           row.id,
    name:         row.name,
    type:         row.type as EventType,
    date:         row.date,
    location:     row.location     ?? undefined,
    active:       row.active,
    deckName:     row.deck_name    ?? undefined,
    deckColors:   row.deck_colors  ?? undefined,
    rank:         row.rank         ?? undefined,
    playersCount: row.players_count ?? undefined,
    matches: (row.matches ?? [])
      // Ordenar por round para garantir ordem correcta
      .sort((a: any, b: any) => a.round - b.round)
      .map((m: any) => ({
        id:             m.id,
        round:          m.round,
        opponent:       m.opponents?.name ?? 'Desconhecido',
        opponentColors: (m.opponent_colors as ManaSelection) ?? { main: [], splash: [] },
        result:         m.result,
        notes:          m.notes ?? undefined,
        createdAt:      m.created_at,
      })),
  };
}

// ─── fetchEvents ─────────────────────────────────────────────────────────────

// Carrega todos os eventos do utilizador actual, com os matches aninhados
export async function fetchEvents(): Promise<Event[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[events] fetchEvents: utilizador não autenticado');
    return [];
  }

  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      matches (
        *,
        opponents ( name )
      )
    `)
    .eq('user_id', user.id)
    .eq('deleted', false)
    .order('date', { ascending: false });

  if (error) {
    console.error('[events] Erro ao carregar eventos:', error.message);
    return [];
  }

  return (data ?? []).map(dbRowToEvent);
}

// ─── createEvent ─────────────────────────────────────────────────────────────

export interface NewEventData {
  name:      string;
  type:      EventType;
  date:      string;   // formato YYYY-MM-DD
  location?: string;
}

// ─── completeEvent ────────────────────────────────────────────────────────────

// Marca o evento como concluído (active: false) e guarda classificação e nº de jogadores
export async function completeEvent(
  eventId: string,
  rank?: string,
  playersCount?: number,
): Promise<boolean> {
  const { error } = await supabase
    .from('events')
    .update({
      active: false,
      rank: rank?.trim() || null,
      players_count: playersCount || null,
    })
    .eq('id', eventId);

  if (error) {
    console.error('[events] Erro ao concluir evento:', error.message);
    return false;
  }

  return true;
}

// ─── deleteEvent ─────────────────────────────────────────────────────────────

// Soft-deletes an event — marks deleted: true so it is excluded from all future queries
export async function deleteEvent(eventId: string): Promise<boolean> {
  const { error } = await supabase
    .from('events')
    .update({ deleted: true })
    .eq('id', eventId);

  if (error) {
    console.error('[events] Erro ao apagar evento:', error.message);
    return false;
  }

  return true;
}

// ─── createEvent ─────────────────────────────────────────────────────────────

// Cria um novo evento e devolve o objecto Event criado
export async function createEvent(data: NewEventData): Promise<Event | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[events] createEvent: utilizador não autenticado');
    return null;
  }

  const { data: row, error } = await supabase
    .from('events')
    .insert({
      user_id:  user.id,
      name:     data.name,
      type:     data.type,
      date:     data.date,
      location: data.location ?? null,
      active:   true,
    })
    .select()
    .single();

  if (error) {
    console.error('[events] Erro ao criar evento:', error.message);
    return null;
  }

  // Evento novo não tem matches ainda
  return dbRowToEvent({ ...row, matches: [] });
}
