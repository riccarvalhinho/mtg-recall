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
 *   createDeck(data)                — cria um deck e devolve o id
 *   updateDeck(id, data)            — altera um deck sem lhe mexer no id
 *   deleteDeck(id)                  — apaga, se nenhum evento o usar
 *   setEventDeck(eventId, deckId)   — liga um deck a um evento
 *   setEventDeckThumbnail(id, card) — escolhe a carta que ilustra o evento
 *   setEventSetCode(id, setCode)    — corrige o set de um evento de Limited
 *   addToCollection(card)           — acrescenta uma carta (soma se já lá estiver)
 *   setCardQuantity(card, n)        — muda a quantidade; 0 tira da colecção
 *   linkCollectionPrinting(c, p)    — aponta uma carta escrita à mão a uma impressão
 *   restoreFromGitHub()             — repõe tudo a partir do bundle publicado
 */
import { create } from 'zustand';
import { withPrinting } from '../domain/collection';
import { pruneOpponents } from '../domain/opponents';
import { repoPaths } from '../domain/outbox';
import { eventId as makeEventId, slugify, uniqueId } from '../domain/slug';
import { isLimitedFormat } from '../domain/sets';
import { thumbnailChoices, thumbnailUrls } from '../domain/thumbnails';
import { prefetchThumbnails } from '../services/imagePrefetch';
import * as localStore from '../services/localStore';
import * as outbox from '../services/outbox';
import {
  opponentNames,
  parseCollection,
  parseDeck,
  parseEvent,
  parseOpponents,
  parsePrices,
  parseValueHistory,
  serializeCollection,
  serializeDeck,
  serializeEvent,
  serializeOpponents,
} from '../services/repoFiles';
import { fetchBundle } from '../services/sync';
import type {
  CollectionCard,
  Deck,
  DeckCard,
  Event,
  EventType,
  Game,
  ManaSelection,
  MatchResult,
  Opponent,
  PriceEntry,
  ValueEntry,
} from '../types';

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

export interface NewDeckData {
  name: string;
  colors: ManaSelection;
  format?: EventType;
  archetype?: string;
  cards?: DeckCard[];
  notes?: string;
  /** A carta que ilustra o deck. Tem de ser uma das cartas dele — ver `domain/thumbnails.ts`. */
  thumbnailCardId?: string;
}

interface EventsStore {
  events: Event[];
  decks: Deck[];
  opponents: Opponent[];
  collection: CollectionCard[];
  /** Escritos pelo CI, lidos do bundle. A app nunca lhes toca — ADR 0007. */
  prices: PriceEntry[];
  valueHistory: ValueEntry[];
  isLoading: boolean;

  load: () => Promise<void>;
  createEvent: (data: NewEventData) => Promise<string | null>;
  addMatch: (eventId: string, data: NewMatchData) => Promise<void>;
  updateMatch: (eventId: string, round: number, data: NewMatchData) => Promise<boolean>;
  createDeck: (data: NewDeckData) => Promise<string>;
  updateDeck: (deckId: string, data: NewDeckData) => Promise<boolean>;
  deleteDeck: (deckId: string) => Promise<{ ok: true } | { ok: false; usedBy: number }>;
  setEventDeck: (eventId: string, deckId: string | undefined) => Promise<boolean>;
  setEventDeckThumbnail: (eventId: string, scryfallId: string | undefined) => Promise<boolean>;
  setEventSetCode: (eventId: string, setCode: string | undefined) => Promise<boolean>;
  addToCollection: (card: CollectionCard) => Promise<void>;
  setCardQuantity: (card: CollectionCard, quantity: number) => Promise<void>;
  linkCollectionPrinting: (
    card: CollectionCard,
    printing: { scryfallId: string; name: string; setCode?: string; collectorNumber?: string },
  ) => Promise<void>;
  completeEvent: (eventId: string, rank?: string, playersCount?: number) => Promise<boolean>;
  deleteEvent: (eventId: string) => Promise<boolean>;
  deleteMatch: (eventId: string, round: number) => Promise<boolean>;
  restoreFromGitHub: (options?: { discardPending?: boolean }) => Promise<RestoreResult>;
}

/**
 * O resultado de um restauro.
 *
 * `pending` não é um erro — é o restauro a recusar-se a correr por cima de trabalho que ainda não
 * chegou ao repositório. Quem chama decide: enviar primeiro, ou insistir e perder.
 */
export type RestoreResult =
  | { ok: true; events: number }
  | { ok: false; kind: 'pending'; pending: number }
  | { ok: false; kind: 'error'; reason: string };

/** Decks por nome — não há data por onde os ordenar, e a ordem de criação não diz nada a ninguém. */
function byName(a: Deck, b: Deck): number {
  return a.name.localeCompare(b.name, 'pt');
}

/** Mais recentes primeiro. O desempate pelo id existe para dois torneios no mesmo dia não trocarem de sítio. */
function byDateDesc(a: Event, b: Event): number {
  return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
}

/**
 * Manda descarregar as miniaturas em segundo plano.
 *
 * Deliberadamente sem `await`: o écran não espera por imagens. Se falhar — sem rede, CDN em baixo —
 * o placeholder faz o seu papel e tenta-se outra vez no próximo arranque. Por isso o `catch` vazio
 * não esconde nada: não há aqui erro nenhum que valha a pena mostrar a ninguém.
 */
function warmThumbnails(decks: Deck[], events: Event[]): void {
  void prefetchThumbnails(thumbnailUrls(decks, events)).catch(() => {});
}

/** Grava um evento na cópia local e põe-no na fila. Um ficheiro, um commit. */
async function persistEvent(event: Event, message: string): Promise<void> {
  const path = repoPaths.event(event.id);
  const content = serializeEvent(event);
  await localStore.writeFile(path, content);
  await outbox.enqueueFile({ path, content, message });
}

/**
 * Resolve o nome escrito no écran numa referência da taxonomia.
 *
 * O adversário nunca é texto livre dentro do evento (ver CLAUDE.md): ou já existe em
 * `opponents.json`, ou passa a existir agora. Partilhado entre registar e editar um match, porque
 * editar pode trocar o adversário e teria o mesmo problema.
 */
function resolveOpponent(
  known: Opponent[],
  rawName: string,
): { opponentId?: string; displayName?: string; opponents: Opponent[]; isNew: boolean } {
  const name = rawName.trim();

  // Sem nome não há adversário nenhum a resolver, e **não se inventa um**. Um torneio antigo
  // carregado de memória pode não ter adversários de que alguém se lembre; pôr lá "Unknown" criava
  // uma pessoa na taxonomia que depois apareceria nas Stats como a mais enfrentada de todas — uma
  // conclusão falsa a partir de um campo vazio. Ausente é ausente.
  if (!name) return { opponentId: undefined, displayName: undefined, opponents: known, isNew: false };

  const opponentId = slugify(name) || 'desconhecido';
  const existing = known.find(opponent => opponent.id === opponentId);

  return {
    opponentId,
    // O nome que manda é o da taxonomia: é lá que se troca um nome por uma alcunha (ADR 0005).
    displayName: existing?.name ?? name,
    opponents: existing ? known : [...known, { id: opponentId, name }],
    isNew: !existing,
  };
}

async function persistDeck(deck: Deck, message: string): Promise<void> {
  const path = repoPaths.deck(deck.id);
  const content = serializeDeck(deck);
  await localStore.writeFile(path, content);
  await outbox.enqueueFile({ path, content, message });
}

async function persistCollection(items: CollectionCard[], message: string): Promise<void> {
  const path = repoPaths.collection;
  const content = serializeCollection(items);
  await localStore.writeFile(path, content);
  await outbox.enqueueFile({ path, content, message });
}

/**
 * Duas entradas são a mesma carta se forem a mesma impressão e a mesma versão.
 *
 * Foil e não-foil são entradas separadas de propósito: valem preços diferentes (ADR 0007). Sem
 * `scryfallId` cai-se para nome + set + número, que é o melhor que há quando a carta foi escrita à
 * mão. A validação chumba duplicados por esta mesma chave — juntar aqui é o que evita escrever um
 * ficheiro que o próprio CI recusa.
 */
function sameCard(a: CollectionCard, b: CollectionCard): boolean {
  if (Boolean(a.foil) !== Boolean(b.foil)) return false;
  if (a.scryfallId && b.scryfallId) return a.scryfallId === b.scryfallId;
  return (
    a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
    (a.setCode ?? '') === (b.setCode ?? '') &&
    (a.collectorNumber ?? '') === (b.collectorNumber ?? '')
  );
}

async function persistOpponents(opponents: Opponent[], message: string): Promise<void> {
  const path = repoPaths.opponents;
  const content = serializeOpponents(opponents);
  await localStore.writeFile(path, content);
  await outbox.enqueueFile({ path, content, message });
}

/**
 * Tira da taxonomia quem deixou de ser referido e grava o ficheiro, se alguém saiu.
 *
 * Chama-se **depois** de o estado já ter os eventos novos: é a lista de eventos que decide quem
 * fica. Quando ninguém sai, devolve a lista tal como veio e não escreve nada — nem ficheiro nem
 * commit por uma coisa que não mudou.
 */
async function persistPrunedOpponents(
  opponents: Opponent[],
  events: Event[],
  message: string,
): Promise<Opponent[]> {
  const kept = pruneOpponents(opponents, events);
  if (kept.length === opponents.length) return opponents;

  await persistOpponents(kept, message);
  return kept;
}

export const useEventsStore = create<EventsStore>((set, get) => ({
  events: [],
  decks: [],
  opponents: [],
  collection: [],
  prices: [],
  valueHistory: [],
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
    const decks: Deck[] = [];
    for (const [path, content] of Object.entries(files)) {
      try {
        if (path.startsWith('data/events/')) events.push(parseEvent(JSON.parse(content), names));
        else if (path.startsWith('data/decks/')) decks.push(parseDeck(JSON.parse(content)));
      } catch (error) {
        // Um ficheiro estragado não pode levar os outros atrás. Fica de fora e diz-se porquê.
        console.warn(`[store] ${path} ilegível:`, error);
      }
    }

    const collection = files[repoPaths.collection]
      ? parseCollection(JSON.parse(files[repoPaths.collection]))
      : [];

    set({
      events: events.sort(byDateDesc),
      decks: decks.sort(byName),
      opponents,
      collection,
      isLoading: false,
    });

    warmThumbnails(decks, events);
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

    const { opponentId, displayName, opponents, isNew } = resolveOpponent(
      get().opponents,
      data.opponent,
    );

    const round = event.matches.length + 1;
    const updated: Event = {
      ...event,
      matches: [
        ...event.matches,
        {
          round,
          opponentId,
          opponent: displayName,
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

    if (isNew) await persistOpponents(opponents, `Add opponent ${displayName}`);
    await persistEvent(updated, `Register round ${round} of ${event.name}`);
  },

  // ─── updateMatch ───────────────────────────────────────────────────────────

  /**
   * Corrige um match já registado, sem lhe mexer na ronda.
   *
   * A ronda é a identidade do match dentro do evento e a ordem da lista tem de bater certo com ela
   * (a validação recusa saltos), portanto editar substitui no sítio em vez de remover e voltar a
   * acrescentar. O adversário pode mudar — um nome mal escrito na loja é a razão mais provável para
   * se estar aqui.
   */
  updateMatch: async (eventId, round, data) => {
    const event = get().events.find(e => e.id === eventId);
    if (!event) return false;

    const target = event.matches.find(match => match.round === round);
    if (!target) return false;

    const { opponentId, displayName, opponents, isNew } = resolveOpponent(
      get().opponents,
      data.opponent,
    );

    const updated: Event = {
      ...event,
      matches: event.matches.map(match =>
        match.round === round
          ? {
              round,
              opponentId,
              opponent: displayName,
              opponentColors: data.opponentColors,
              result: data.result,
              wentFirst: data.wentFirst,
              games: data.games,
              notes: data.notes,
            }
          : match,
      ),
    };

    const events = get().events.map(e => (e.id === eventId ? updated : e));
    set({ events, opponents });

    if (isNew) await persistOpponents(opponents, `Add opponent ${displayName}`);
    await persistEvent(updated, `Edit round ${round} of ${event.name}`);

    // Corrigir um nome mal escrito cria um id novo e deixa o antigo a apontar para ninguém. É a
    // razão mais provável para se estar aqui, portanto é aqui que se varre.
    const kept = await persistPrunedOpponents(opponents, events, 'Clean up unreferenced opponents');
    set({ opponents: kept });
    return true;
  },

  // ─── decks ─────────────────────────────────────────────────────────────────

  /** Cria um deck e devolve o id. O slug vem do nome, com sufixo se já existir. */
  createDeck: async (data) => {
    const taken = get().decks.map(deck => deck.id);
    const id = uniqueId(slugify(data.name) || 'deck', taken);

    const deck: Deck = {
      id,
      name: data.name.trim(),
      colors: data.colors,
      format: data.format,
      archetype: data.archetype,
      cards: data.cards,
      notes: data.notes,
      thumbnailCardId: data.thumbnailCardId,
    };

    set(state => ({ decks: [...state.decks, deck].sort(byName) }));
    await persistDeck(deck, `Create deck ${deck.name}`);
    return id;
  },

  /**
   * Altera um deck sem lhe mexer no id.
   *
   * O id fica como está mesmo quando o nome muda: é a referência que os eventos guardam, e
   * renomeá-lo obrigaria a reescrever todos os eventos que apontam para ele — muitos ficheiros e
   * muitos commits para uma gralha no nome.
   */
  updateDeck: async (deckId, data) => {
    const deck = get().decks.find(d => d.id === deckId);
    if (!deck) return false;

    const updated: Deck = {
      ...deck,
      name: data.name.trim(),
      colors: data.colors,
      format: data.format,
      archetype: data.archetype,
      cards: data.cards,
      notes: data.notes,
      // Explícito e não herdado do spread: sem isto, largar a escolha era impossível — o valor
      // antigo sobrevivia a um `undefined`.
      thumbnailCardId: data.thumbnailCardId,
    };

    set(state => ({ decks: state.decks.map(d => (d.id === deckId ? updated : d)).sort(byName) }));
    await persistDeck(updated, `Update deck ${updated.name}`);
    return true;
  },

  /**
   * Apaga um deck — mas só se nenhum evento apontar para ele.
   *
   * Um evento com um `deckId` que já não existe passa no schema e é chumbado pelo `npm run
   * validate`, ou seja, só daria erro **depois** do commit. Recusar aqui é mais honesto do que
   * limpar o campo em silêncio em cinco eventos antigos, que é reescrever história que o utilizador
   * não pediu para reescrever.
   */
  deleteDeck: async (deckId) => {
    const usedBy = get().events.filter(event => event.deckId === deckId).length;
    if (usedBy > 0) return { ok: false, usedBy };

    const deck = get().decks.find(d => d.id === deckId);
    if (!deck) return { ok: true };

    set(state => ({ decks: state.decks.filter(d => d.id !== deckId) }));

    const path = repoPaths.deck(deckId);
    await localStore.removeFile(path);
    await outbox.enqueueFile({ path, content: null, message: `Delete deck ${deck.name}` });
    return { ok: true };
  },

  /** Liga (ou desliga) um deck a um evento. */
  setEventDeck: async (eventId, deckId) => {
    const event = get().events.find(e => e.id === eventId);
    if (!event) return false;
    if (deckId && !get().decks.some(deck => deck.id === deckId)) return false;

    // Trocar de deck larga a carta escolhida: ela era do deck anterior, e um evento ilustrado por
    // uma carta que o deck já não tem é pior do que um evento sem ilustração escolhida — passa a
    // herdar a do deck novo, que é o que `eventThumbnailUrl` faz sozinho.
    const keepThumbnail = deckId === event.deckId;
    const updated: Event = {
      ...event,
      deckId,
      deckThumbnailCardId: keepThumbnail ? event.deckThumbnailCardId : undefined,
    };

    set(state => ({ events: state.events.map(e => (e.id === eventId ? updated : e)) }));
    await persistEvent(updated, `Set deck of ${event.name}`);
    return true;
  },

  /**
   * Escolhe a carta que ilustra o evento, de entre as do deck ligado.
   *
   * Valida que a carta é mesmo do deck: o campo é uma referência, e uma referência para uma carta
   * que o deck não tem não desenharia nada. `undefined` larga a escolha e volta a herdar a do deck.
   */
  setEventDeckThumbnail: async (eventId, scryfallId) => {
    const event = get().events.find(e => e.id === eventId);
    if (!event) return false;

    if (scryfallId) {
      const deck = get().decks.find(d => d.id === event.deckId);
      if (!thumbnailChoices(deck?.cards).some(choice => choice.scryfallId === scryfallId)) {
        return false;
      }
    }

    const updated: Event = { ...event, deckThumbnailCardId: scryfallId };

    set(state => ({ events: state.events.map(e => (e.id === eventId ? updated : e)) }));
    await persistEvent(updated, `Set thumbnail of ${event.name}`);
    return true;
  },

  /**
   * Corrige o set de um evento de Limited depois de criado.
   *
   * Só em Limited, pela mesma regra do écran de criação: num evento de Constructed o set não quer
   * dizer nada, e guardá-lo lá seria guardar ruído.
   */
  setEventSetCode: async (eventId, setCode) => {
    const event = get().events.find(e => e.id === eventId);
    if (!event) return false;
    if (!isLimitedFormat(event.type)) return false;

    const updated: Event = { ...event, setCode: setCode?.trim().toLowerCase() || undefined };

    set(state => ({ events: state.events.map(e => (e.id === eventId ? updated : e)) }));
    await persistEvent(updated, `Set set of ${event.name}`);
    return true;
  },

  // ─── colecção ──────────────────────────────────────────────────────────────

  /** Acrescenta uma carta. Se já lá estiver a mesma versão, soma à quantidade em vez de duplicar. */
  addToCollection: async (card) => {
    const existing = get().collection.find(item => sameCard(item, card));

    const collection = existing
      ? get().collection.map(item =>
          sameCard(item, card)
            ? { ...item, quantity: Math.min(item.quantity + card.quantity, 9999) }
            : item,
        )
      : [...get().collection, card];

    set({ collection });
    await persistCollection(collection, `Add ${card.name} to collection`);
  },

  /** Muda a quantidade. Zero ou menos tira a carta da colecção — o schema exige mínimo de 1. */
  /**
   * Aponta uma carta escrita à mão a uma impressão concreta, para ela passar a ter preço.
   *
   * Se a colecção já tiver essa impressão — a mesma carta acrescentada duas vezes, uma à mão e
   * outra pela procura — as duas juntam-se numa entrada só. Tinha de ser: a validação recusa
   * duplicados pela mesma chave, e escrever um ficheiro que o próprio CI chumba é pior do que não
   * escrever nada.
   */
  linkCollectionPrinting: async (card, printing) => {
    const linked = withPrinting(card, printing);

    let merged = false;
    const collection: CollectionCard[] = [];
    for (const item of get().collection) {
      if (sameCard(item, card)) continue;

      if (sameCard(item, linked)) {
        merged = true;
        collection.push({ ...item, quantity: Math.min(item.quantity + linked.quantity, 9999) });
      } else {
        collection.push(item);
      }
    }
    if (!merged) collection.push(linked);

    set({ collection });
    await persistCollection(collection, `Link ${linked.name} to a printing`);
  },

  setCardQuantity: async (card, quantity) => {
    const collection =
      quantity <= 0
        ? get().collection.filter(item => !sameCard(item, card))
        : get().collection.map(item =>
            sameCard(item, card) ? { ...item, quantity: Math.min(quantity, 9999) } : item,
          );

    set({ collection });
    await persistCollection(
      collection,
      quantity <= 0 ? `Remove ${card.name} from collection` : `Update ${card.name} quantity`,
    );
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

    const events = get().events.filter(e => e.id !== eventId);
    set({ events });

    // Apaga mesmo o ficheiro em vez de o marcar: o histórico do Git é a rede de segurança, e um
    // evento apagado que continuasse no repositório voltaria a aparecer no próximo restauro.
    const path = repoPaths.event(eventId);
    await localStore.removeFile(path);
    await outbox.enqueueFile({ path, content: null, message: `Delete event ${event.name}` });

    // Quem só se enfrentou nesse dia deixa de ser referido por match nenhum.
    const kept = await persistPrunedOpponents(get().opponents, events, 'Clean up unreferenced opponents');
    set({ opponents: kept });
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

    const events = get().events.map(e => (e.id === eventId ? updated : e));
    set({ events });
    await persistEvent(updated, `Delete round ${round} of ${event.name}`);

    const kept = await persistPrunedOpponents(get().opponents, events, 'Clean up unreferenced opponents');
    set({ opponents: kept });
    return true;
  },

  // ─── restoreFromGitHub ─────────────────────────────────────────────────────

  restoreFromGitHub: async (options) => {
    // A fila não sobrevive a um restauro. O que está por enviar ainda não existe no repositório,
    // portanto não vem no bundle: deixá-la viva significava vê-la ser enviada logo a seguir, por
    // cima do que acabou de ser restaurado, e ficar com o telemóvel e o GitHub a discordar.
    const pending = await outbox.pendingCount();
    if (pending > 0 && !options?.discardPending) {
      return { ok: false, kind: 'pending', pending };
    }

    try {
      // A rede primeiro: se o bundle não vier, nada foi tocado e não há nada a desfazer.
      const remote = await fetchBundle();
      const names = opponentNames(remote.opponents);

      const events = remote.events.map(raw => parseEvent(raw, names));
      const decks = (remote.decks ?? []).map(parseDeck);
      const files: Record<string, string> = {
        [repoPaths.opponents]: serializeOpponents(remote.opponents),
      };
      for (const event of events) files[repoPaths.event(event.id)] = serializeEvent(event);
      for (const deck of decks) files[repoPaths.deck(deck.id)] = serializeDeck(deck);

      const collection = parseCollection({ items: remote.collection ?? [] });
      if (collection.length > 0) files[repoPaths.collection] = serializeCollection(collection);

      // Limpar antes de substituir: se alguma coisa falhar a meio, fica-se sem a fila mas com os
      // ficheiros locais intactos — que é o lado seguro, porque a próxima alteração volta a
      // enfileirá-los. Ao contrário, uma fila viva sobre ficheiros novos enviava dados velhos.
      await outbox.clear();

      // Substitui a cópia local sem passar pela outbox: isto veio do repositório, reenviá-lo seria
      // commitar o que já lá está.
      await localStore.replaceAll(files);
      set({
        events: events.sort(byDateDesc),
        decks: decks.sort(byName),
        opponents: remote.opponents,
        collection,
        // Preços e histórico vêm do bundle e ficam só em memória: são escritos pelo CI e a app não
        // tem nada que os guardar na cópia local nem que os reenviar (ADR 0007).
        prices: parsePrices(remote.prices ?? []),
        valueHistory: parseValueHistory(remote.valueHistory ?? []),
      });

      warmThumbnails(decks, events);

      return { ok: true, events: events.length };
    } catch (error) {
      return { ok: false, kind: 'error', reason: (error as Error).message };
    }
  },
}));
