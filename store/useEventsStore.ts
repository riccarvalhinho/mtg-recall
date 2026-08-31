/**
 * Store global — Zustand. A fonte de verdade da interface durante a sessão.
 *
 * Local-first (ADR 0004): cada acção actualiza o estado, grava o ficheiro na cópia local e põe-no na
 * outbox. **Nenhuma acção espera pela rede** — o écran já está actualizado quando o commit ainda nem
 * começou, e num torneio sem rede tudo funciona na mesma.
 *
 * Acções:
 *   load()                          — lê a cópia local (chamar no arranque)
 *   createEvent(data)               — cria um evento e devolve o id
 *   addMatch(eventId, data)         — regista uma ronda
 *   completeEvent(id, rank, count)  — fecha o torneio
 *   deleteEvent(id)                 — apaga o evento e o seu ficheiro
 *   deleteMatch(eventId, round)     — apaga uma ronda e renumera as seguintes
 *   restoreFromGitHub()             — repõe tudo a partir do bundle publicado
 */
import { create } from 'zustand';
import { repoPaths } from '../domain/outbox';
import { eventId as makeEventId, slugify, uniqueId } from '../domain/slug';
import * as localStore from '../services/localStore';
import * as outbox from '../services/outbox';
import {
  opponentNames,
  parseEvent,
  parseOpponents,
  serializeEvent,
  serializeOpponents,
} from '../services/repoFiles';
import { fetchBundle } from '../services/sync';
import type { Event, EventType, Game, ManaSelection, MatchResult, Opponent } from '../types';

export interface NewEventData {
  name: string;
  type: EventType;
  date: string; // AAAA-MM-DD
  location?: string;
  setCode?: string;
}

export interface NewMatchData {
  /** O nome como o utilizador o escreveu. Vira referência aqui dentro, nunca no écran. */
  opponent: string;
  opponentColors: ManaSelection;
  result: MatchResult;
  wentFirst?: boolean;
  games?: Game[];
  notes?: string;
}

interface EventsStore {
  events: Event[];
  opponents: Opponent[];
  isLoading: boolean;

  load: () => Promise<void>;
  createEvent: (data: NewEventData) => Promise<string | null>;
  addMatch: (eventId: string, data: NewMatchData) => Promise<void>;
  completeEvent: (eventId: string, rank?: string, playersCount?: number) => Promise<boolean>;
  deleteEvent: (eventId: string) => Promise<boolean>;
  deleteMatch: (eventId: string, round: number) => Promise<boolean>;
  restoreFromGitHub: () => Promise<{ ok: true; events: number } | { ok: false; reason: string }>;
}

/** Mais recentes primeiro. O desempate pelo id existe para dois torneios no mesmo dia não trocarem de sítio. */
function byDateDesc(a: Event, b: Event): number {
  return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
}

/** Grava um evento na cópia local e põe-no na fila. Um ficheiro, um commit. */
async function persistEvent(event: Event, message: string): Promise<void> {
  const path = repoPaths.event(event.id);
  const content = serializeEvent(event);
  await localStore.writeFile(path, content);
  await outbox.enqueueFile({ path, content, message });
}

async function persistOpponents(opponents: Opponent[], message: string): Promise<void> {
  const path = repoPaths.opponents;
  const content = serializeOpponents(opponents);
  await localStore.writeFile(path, content);
  await outbox.enqueueFile({ path, content, message });
}

export const useEventsStore = create<EventsStore>((set, get) => ({
  events: [],
  opponents: [],
  isLoading: false,

  // ─── load ──────────────────────────────────────────────────────────────────

  load: async () => {
    set({ isLoading: true });

    const files = await localStore.readAll();
    const opponents = files[repoPaths.opponents]
      ? parseOpponents(JSON.parse(files[repoPaths.opponents]))
      : [];
    const names = opponentNames(opponents);

    const events: Event[] = [];
    for (const [path, content] of Object.entries(files)) {
      if (!path.startsWith('data/events/')) continue;
      try {
        events.push(parseEvent(JSON.parse(content), names));
      } catch (error) {
        // Um ficheiro estragado não pode levar os outros atrás. Fica de fora e diz-se porquê.
        console.warn(`[store] ${path} ilegível:`, error);
      }
    }

    set({ events: events.sort(byDateDesc), opponents, isLoading: false });
  },

  // ─── createEvent ───────────────────────────────────────────────────────────

  createEvent: async (data) => {
    const taken = get().events.map(event => event.id);
    const id = uniqueId(makeEventId(data.date, data.name), taken);

    const event: Event = {
      id,
      name: data.name.trim(),
      type: data.type,
      setCode: data.setCode,
      date: data.date,
      location: data.location,
      status: 'active',
      matches: [],
    };

    set(state => ({ events: [event, ...state.events].sort(byDateDesc) }));
    await persistEvent(event, `Create event ${event.name}`);
    return id;
  },

  // ─── addMatch ──────────────────────────────────────────────────────────────

  addMatch: async (eventId, data) => {
    const event = get().events.find(e => e.id === eventId);
    if (!event) return;

    // O adversário é uma referência: ou já existe na taxonomia, ou passa a existir agora.
    const name = data.opponent.trim();
    const opponentId = slugify(name) || 'desconhecido';
    const known = get().opponents.find(opponent => opponent.id === opponentId);
    const opponents = known ? get().opponents : [...get().opponents, { id: opponentId, name }];

    const round = event.matches.length + 1;
    const updated: Event = {
      ...event,
      matches: [
        ...event.matches,
        {
          round,
          opponentId,
          opponent: known?.name ?? name,
          opponentColors: data.opponentColors,
          result: data.result,
          wentFirst: data.wentFirst,
          games: data.games,
          notes: data.notes,
        },
      ],
    };

    set(state => ({
      events: state.events.map(e => (e.id === eventId ? updated : e)),
      opponents,
    }));

    if (!known) await persistOpponents(opponents, `Add opponent ${name}`);
    await persistEvent(updated, `Register round ${round} of ${event.name}`);
  },

  // ─── completeEvent ─────────────────────────────────────────────────────────

  completeEvent: async (eventId, rank, playersCount) => {
    const event = get().events.find(e => e.id === eventId);
    if (!event) return false;

    const updated: Event = {
      ...event,
      status: 'completed',
      rank: rank?.trim() || undefined,
      playersCount: playersCount || undefined,
    };

    set(state => ({ events: state.events.map(e => (e.id === eventId ? updated : e)) }));
    await persistEvent(updated, `Complete event ${event.name}`);
    return true;
  },

  // ─── deleteEvent ───────────────────────────────────────────────────────────

  deleteEvent: async (eventId) => {
    const event = get().events.find(e => e.id === eventId);
    if (!event) return false;

    set(state => ({ events: state.events.filter(e => e.id !== eventId) }));

    // Apaga mesmo o ficheiro em vez de o marcar: o histórico do Git é a rede de segurança, e um
    // evento apagado que continuasse no repositório voltaria a aparecer no próximo restauro.
    const path = repoPaths.event(eventId);
    await localStore.removeFile(path);
    await outbox.enqueueFile({ path, content: null, message: `Delete event ${event.name}` });
    return true;
  },

  // ─── deleteMatch ───────────────────────────────────────────────────────────

  deleteMatch: async (eventId, round) => {
    const event = get().events.find(e => e.id === eventId);
    if (!event) return false;

    // Renumerar as seguintes: a ronda é a identidade do match dentro do evento, e um buraco na
    // sequência é recusado pelo `npm run validate` (ver open-questions Q5).
    const updated: Event = {
      ...event,
      matches: event.matches
        .filter(match => match.round !== round)
        .map((match, index) => ({ ...match, round: index + 1 })),
    };

    set(state => ({ events: state.events.map(e => (e.id === eventId ? updated : e)) }));
    await persistEvent(updated, `Delete round ${round} of ${event.name}`);
    return true;
  },

  // ─── restoreFromGitHub ─────────────────────────────────────────────────────

  restoreFromGitHub: async () => {
    try {
      const remote = await fetchBundle();
      const names = opponentNames(remote.opponents);

      const events = remote.events.map(raw => parseEvent(raw, names));
      const files: Record<string, string> = {
        [repoPaths.opponents]: serializeOpponents(remote.opponents),
      };
      for (const event of events) files[repoPaths.event(event.id)] = serializeEvent(event);

      // Substitui a cópia local sem passar pela outbox: isto veio do repositório, reenviá-lo seria
      // commitar o que já lá está.
      await localStore.replaceAll(files);
      set({ events: events.sort(byDateDesc), opponents: remote.opponents });

      return { ok: true, events: events.length };
    } catch (error) {
      return { ok: false, reason: (error as Error).message };
    }
  },
}));
