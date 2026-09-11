/**
 * A cache das cartas — a forma e as contas, sem AsyncStorage à mistura.
 *
 * `services/scryfall.ts` lê e escreve isto numa chave própria (`mtgrecall.scryfall.cards`). É
 * **cache, não são dados nossos**: não passa pela outbox nem pelo `localStore`, e por isso nunca
 * aparece num commit — a mesma regra da lista de sets.
 *
 * ## O que se guarda
 *
 * Duas coisas ao mesmo tempo, porque servem perguntas diferentes:
 *
 *  - **`queries`** — o que cada procura devolveu. Procurar "bolt" outra vez não volta a ir à rede.
 *  - **`cards`** — as cartas em si, por id. É o que permite responder alguma coisa sem rede a uma
 *    procura que nunca se fez: quem já procurou "lightning bolt" há de encontrar "bolt" offline.
 *
 * ## Porque é que há limites
 *
 * O AsyncStorage do Android não é infinito e isto cresce a cada letra escrita. Guardar tudo para
 * sempre acabaria por dar erros de escrita em cima de um écran de procura — por isso as procuras
 * velhas caem, e as cartas que ficam sem nenhuma procura a apontar para elas caem com elas.
 */
import type { ScryfallCard } from './cards';
import { normalizeQuery } from './cards';

/** Sobe quando a forma mudar, para uma app nova não ler o que uma antiga escreveu. */
export const CARD_CACHE_VERSION = 1;

/** Procuras lembradas. Quarenta chega para uma época de construir um deck. */
export const MAX_CACHED_QUERIES = 40;

/** Cartas lembradas ao todo, depois de caírem as órfãs. */
export const MAX_CACHED_CARDS = 600;

/** Resultados guardados por procura. A Scryfall devolve 175 por página; guardar tudo era ruído. */
export const MAX_RESULTS_PER_QUERY = 40;

interface CachedQuery {
  /** Quando a procura foi feita, para a validade. */
  fetchedAt: number;
  /** Os ids devolvidos, pela ordem em que vieram — a ordem da Scryfall é relevância. */
  ids: string[];
}

export interface CardCache {
  version: number;
  queries: Record<string, CachedQuery>;
  cards: Record<string, ScryfallCard>;
}

export function emptyCardCache(): CardCache {
  return { version: CARD_CACHE_VERSION, queries: {}, cards: {} };
}

/** Uma cache ilegível ou de outra versão é o mesmo que não haver cache. */
export function isCardCache(value: unknown): value is CardCache {
  if (!value || typeof value !== 'object') return false;
  const cache = value as CardCache;
  return (
    cache.version === CARD_CACHE_VERSION &&
    !!cache.queries && typeof cache.queries === 'object' &&
    !!cache.cards && typeof cache.cards === 'object'
  );
}

/** "Lightning  BOLT" e "lightning bolt" são a mesma procura e não merecem duas entradas. */
export function queryKey(query: string): string {
  return normalizeQuery(query).toLowerCase();
}

/** Minúsculas e sem acentos — o mesmo princípio de `domain/search.ts` e `domain/slug.ts`. */
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * O que uma procura devolveu da última vez, se ainda estiver dentro da validade.
 *
 * `null` distingue-se de `[]`: um array vazio é "já procurei e não há nada", e não vale a pena ir
 * outra vez à rede por isso.
 */
export function readCachedQuery(
  cache: CardCache,
  query: string,
  maxAgeMs: number,
  now: number = Date.now(),
): ScryfallCard[] | null {
  const entry = cache.queries[queryKey(query)];
  if (!entry) return null;
  if (now - entry.fetchedAt >= maxAgeMs) return null;

  // Um id sem carta é uma cache a meio (escrita interrompida). Devolver a lista furada seria pior do
  // que ir à rede outra vez.
  const cards = entry.ids.map(id => cache.cards[id]).filter((card): card is ScryfallCard => !!card);
  if (cards.length !== entry.ids.length) return null;
  return cards;
}

/** As cartas que alguma procura ainda refere. */
function referencedIds(queries: Record<string, CachedQuery>): Set<string> {
  const ids = new Set<string>();
  for (const entry of Object.values(queries)) for (const id of entry.ids) ids.add(id);
  return ids;
}

/** As procuras da mais recente para a mais antiga. */
function byNewest(queries: Record<string, CachedQuery>): [string, CachedQuery][] {
  return Object.entries(queries).sort((a, b) => b[1].fetchedAt - a[1].fetchedAt);
}

/**
 * Guarda o resultado de uma procura e arruma a cache a seguir.
 *
 * Devolve uma cache nova em vez de mexer na que recebeu: quem chama grava o que sai, e uma escrita
 * falhada não deixa a memória a dizer uma coisa e o disco outra.
 */
export function rememberQuery(
  cache: CardCache,
  query: string,
  cards: ScryfallCard[],
  now: number = Date.now(),
): CardCache {
  const kept = cards.slice(0, MAX_RESULTS_PER_QUERY);

  const queries: Record<string, CachedQuery> = {
    ...cache.queries,
    [queryKey(query)]: { fetchedAt: now, ids: kept.map(card => card.scryfallId) },
  };

  const cardsById: Record<string, ScryfallCard> = { ...cache.cards };
  for (const card of kept) cardsById[card.scryfallId] = card;

  return prune({ version: CARD_CACHE_VERSION, queries, cards: cardsById });
}

/**
 * Corta a cache até caber nos limites.
 *
 * Primeiro caem as procuras mais velhas, depois as cartas que ficaram sem ninguém a apontar para
 * elas. Se mesmo assim houver cartas a mais, cai mais uma procura — e por aí fora.
 */
export function prune(cache: CardCache): CardCache {
  let ordered = byNewest(cache.queries).slice(0, MAX_CACHED_QUERIES);

  for (;;) {
    const queries = Object.fromEntries(ordered);
    const keep = referencedIds(queries);

    if (keep.size <= MAX_CACHED_CARDS || ordered.length <= 1) {
      const cards: Record<string, ScryfallCard> = {};
      for (const id of keep) if (cache.cards[id]) cards[id] = cache.cards[id];
      return { version: CARD_CACHE_VERSION, queries, cards };
    }

    ordered = ordered.slice(0, -1);
  }
}

/**
 * O melhor que se consegue sem rede: procurar por nome nas cartas já vistas.
 *
 * Não substitui a Scryfall — só encontra o que já passou por aqui — mas entre "nada" e "as cartas
 * que já usaste", numa loja sem rede, a segunda é a resposta útil. Os nomes que **começam** pelo que
 * foi escrito sobem ao topo, porque é quase sempre isso que se procura.
 */
export function searchCachedCards(cache: CardCache, query: string, limit = MAX_RESULTS_PER_QUERY): ScryfallCard[] {
  const terms = normalizeText(normalizeQuery(query)).split(' ').filter(term => term.length > 0);
  if (terms.length === 0) return [];

  const matches = Object.values(cache.cards).filter(card => {
    const name = normalizeText(card.name);
    return terms.every(term => name.includes(term));
  });

  const first = terms[0];
  return matches
    .sort((a, b) => {
      const startsA = normalizeText(a.name).startsWith(first) ? 0 : 1;
      const startsB = normalizeText(b.name).startsWith(first) ? 0 : 1;
      return startsA - startsB || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}
