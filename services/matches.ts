// services/matches.ts — CRUD de matches via Supabase
// Inclui upsert de adversário (cria se não existir, reutiliza se já existir)

import { supabase } from './supabase';
import { Match, ManaSelection, MatchResult } from '../types';

// ─── upsertOpponent ───────────────────────────────────────────────────────────

// Garante que o adversário existe na tabela opponents (cria se necessário)
// Devolve o ID do adversário
async function upsertOpponent(userId: string, name: string): Promise<string | null> {
  // Verificar se já existe um adversário com este nome
  const { data: existing } = await supabase
    .from('opponents')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name.trim())
    .maybeSingle();

  if (existing) return existing.id;

  // Criar novo adversário
  const { data: created, error } = await supabase
    .from('opponents')
    .insert({ user_id: userId, name: name.trim() })
    .select('id')
    .single();

  if (error) {
    console.error('[matches] Erro ao criar adversário:', error.message);
    return null;
  }

  return created.id;
}

// ─── createMatch ─────────────────────────────────────────────────────────────

export interface NewMatchData {
  opponent:       string;
  opponentColors: ManaSelection;
  result:         MatchResult;
  notes?:         string;
}

// Cria um match e devolve o objecto Match para o store
export async function createMatch(
  eventId: string,
  round:   number,
  data:    NewMatchData,
): Promise<Match | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[matches] createMatch: utilizador não autenticado');
    return null;
  }

  // Garantir que o adversário existe e obter o seu ID
  const opponentId = await upsertOpponent(user.id, data.opponent);
  // opponentId pode ser null se houver erro — match é criado na mesma, sem FK

  const { data: row, error } = await supabase
    .from('matches')
    .insert({
      event_id:        eventId,
      opponent_id:     opponentId,
      round,
      result:          data.result,
      opponent_colors: data.opponentColors, // ManaSelection { main, splash } guardado como jsonb
      notes:           data.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[matches] Erro ao criar match:', error.message);
    return null;
  }

  return {
    id:             row.id,
    round:          row.round,
    opponent:       data.opponent.trim(),
    opponentColors: row.opponent_colors as ManaSelection,
    result:         row.result as MatchResult,
    notes:          row.notes ?? undefined,
    createdAt:      row.created_at,
  };
}

// ─── deleteMatch ─────────────────────────────────────────────────────────────

export async function deleteMatch(matchId: string): Promise<boolean> {
  const { error } = await supabase
    .from('matches')
    .delete()
    .eq('id', matchId);

  if (error) {
    console.error('[matches] Erro ao apagar match:', error.message);
    return false;
  }

  return true;
}
