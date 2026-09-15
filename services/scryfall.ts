/**
 * Scryfall — o único sítio da app que fala com a API das cartas.
 *
 * Hoje serve só a lista de sets, para o evento deixar de ter o código escrito à mão. A Fase 3 (Card
 * Search) entra aqui, não nos écrans.
 *
 * ## Cache, não dados nossos
 *
 * O que vem da Scryfall **não** passa pela outbox nem pelo `localStore`: aqueles guardam ficheiros do
 * repositório, e a lista de sets não é nossa nem deve aparecer num commit. Vive numa chave à parte
 * do AsyncStorage, com validade — saem cinco ou seis sets por ano, e uma cache de uma semana é mais
 * do que suficiente.
 *
 * ## Offline primeiro
 *
 * A app abre numa loja sem rede (regra 3 do CLAUDE.md). Por isso: cache válida responde sem tocar na
 * rede; sem rede, responde cache velha em vez de falhar; e sem cache nenhuma devolve lista vazia e
 * um motivo — quem chama trata isso mostrando o campo de escrever o código à mão, como era antes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  emptyCardCache,
  isCardCache,
  readCachedQuery,
  rememberQuery,
  searchCachedCards,
  type CardCache,
} from '../domain/cardCache';
import {
  cardNameKey,
  isSearchableQuery,
  normalizeCard,
  normalizeCardSearch,
  normalizeQuery,
  type CardQuery,
  type ScryfallCard,
} from '../domain/cards';
import { normalizeSets, type MtgSet } from '../domain/sets';
import {
  chooseBasicLandPrintings,
  type BasicLandPrinting,
} from '../domain/basicLands';

const SETS_KEY = 'mtgrecall.scryfall.sets';
const SETS_URL = 'https://api.scryfall.com/sets';

/** Uma semana. Sets novos saem poucas vezes por ano; ir buscar mais vezes não descobria nada. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Sobe quando a forma da cache mudar, para uma app nova não ler o que uma antiga escreveu. */
const CACHE_VERSION = 1;

/**
 * Rate limit da Scryfall: 50–100 ms entre pedidos (CLAUDE.md § APIs).
 *
 * Hoje é um pedido só, mas a regra vive aqui em vez de em quem chama — quando a Fase 3 acrescentar
 * pesquisa de cartas, já está tratado e não há duas implementações a divergir.
 */
const MIN_INTERVAL_MS = 100;

let lastRequestAt = 0;

/** A cauda da fila de pedidos. Ver scryfallFetch. */
let pending: Promise<void> = Promise.resolve();

/** Pedido em curso. Dois écrans a pedir a lista ao mesmo tempo partilham-no — nunca dois pedidos em paralelo. */
let inFlight: Promise<MtgSet[]> | null = null;

interface SetsCache {
  version: number;
  fetchedAt: number;
  sets: MtgSet[];
}

/** De onde veio a lista, para a interface poder ser honesta sobre o que está a mostrar. */
export type SetsSource = 'network' | 'cache' | 'none';

export interface SetsResult {
  sets: MtgSet[];
  source: SetsSource;
  /** Quando a lista foi buscada à Scryfall. Ausente quando não há cache nenhuma. */
  fetchedAt?: number;
  /** O que correu mal, quando a rede falhou. Não impede `sets` de vir preenchido a partir da cache. */
  error?: string;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readCache(): Promise<SetsCache | null> {
  try {
    const raw = await AsyncStorage.getItem(SETS_KEY);
    if (!raw) return null;

    const cache = JSON.parse(raw) as SetsCache;
    if (cache.version !== CACHE_VERSION || !Array.isArray(cache.sets)) return null;
    return cache;
  } catch {
    // Cache ilegível é o mesmo que não haver cache. Não vale a pena deitar nada abaixo por isto.
    return null;
  }
}

async function writeCache(sets: MtgSet[]): Promise<void> {
  const cache: SetsCache = { version: CACHE_VERSION, fetchedAt: Date.now(), sets };
  try {
    await AsyncStorage.setItem(SETS_KEY, JSON.stringify(cache));
  } catch (error) {
    // Falhar a escrever a cache não estraga o pedido que acabou de correr bem.
    console.warn('[scryfall] não foi possível guardar a cache dos sets:', error);
  }
}

/**
 * Todos os pedidos à Scryfall passam por aqui.
 *
 * Espera o intervalo mínimo e serializa: nunca há dois pedidos em voo ao mesmo tempo, venham dos
 * sets ou da procura de cartas. Ter uma fila só é o que faz o rate limit ser real — duas filas
 * independentes respeitariam 100 ms cada uma e mandariam o dobro dos pedidos.
 */
async function scryfallFetch(url: string, what: string): Promise<unknown> {
  const run = async () => {
    const since = Date.now() - lastRequestAt;
    if (since < MIN_INTERVAL_MS) await wait(MIN_INTERVAL_MS - since);
    lastRequestAt = Date.now();

    // A Scryfall pede um User-Agent que a identifique — é a única forma de ela saber quem está a
    // bater à porta quando alguma coisa corre mal do lado dela.
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'MTGRecall/1.0' },
    });

    // 404 numa procura significa "não há cartas assim", que não é uma avaria.
    if (response.status === 404) return { data: [] };

    if (!response.ok) {
      throw new Error(`Scryfall answered ${response.status} when asking for ${what}.`);
    }

    return response.json();
  };

  // Encadeia no pedido anterior em vez de o substituir.
  const queued = pending.then(run, run);
  pending = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued;
}

/**
 * O mesmo portão, para os pedidos que levam corpo.
 *
 * Partilha a fila e o intervalo com o `scryfallFetch` — se tivesse fila própria, dois pedidos
 * podiam sair ao mesmo tempo e o rate limit deixava de ser respeitado.
 */
async function scryfallPost(url: string, body: unknown, what: string): Promise<unknown> {
  const run = async () => {
    const since = Date.now() - lastRequestAt;
    if (since < MIN_INTERVAL_MS) await wait(MIN_INTERVAL_MS - since);
    lastRequestAt = Date.now();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'MTGRecall/1.0',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Scryfall answered ${response.status} when asking for ${what}.`);
    }

    return response.json();
  };

  const queued = pending.then(run, run);
  pending = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued;
}

async function fetchSetsFromNetwork(): Promise<MtgSet[]> {
  if (inFlight) return inFlight;

  inFlight = (async () => normalizeSets(await scryfallFetch(SETS_URL, 'the set list')))();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/**
 * A lista de sets jogáveis, do mais recente para o mais antigo.
 *
 * Nunca atira: quem chama recebe sempre um resultado, nem que seja uma lista vazia com o motivo.
 * Num écran de registo de torneio, um erro por cima do formulário não ajudava ninguém.
 *
 * @param options.force ignora a validade da cache e vai à rede na mesma (o botão de "tentar outra vez")
 */
export async function loadSets(options: { force?: boolean } = {}): Promise<SetsResult> {
  const cache = await readCache();
  const fresh = cache !== null && Date.now() - cache.fetchedAt < MAX_AGE_MS;

  if (cache && fresh && !options.force) {
    return { sets: cache.sets, source: 'cache', fetchedAt: cache.fetchedAt };
  }

  try {
    const sets = await fetchSetsFromNetwork();

    // Uma resposta vazia é suspeita (API mudou, proxy pelo meio). Antes a cache velha do que nada.
    if (sets.length === 0 && cache) {
      return {
        sets: cache.sets,
        source: 'cache',
        fetchedAt: cache.fetchedAt,
        error: 'Scryfall returned no usable sets.',
      };
    }

    await writeCache(sets);
    return { sets, source: 'network', fetchedAt: Date.now() };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    // Sem rede vale a cache velha: um set do ano passado continua a ser o set de um torneio antigo.
    if (cache) return { sets: cache.sets, source: 'cache', fetchedAt: cache.fetchedAt, error: reason };
    return { sets: [], source: 'none', error: reason };
  }
}

/** Esquece a cache. Existe para o Settings e para os testes manuais; a app não precisa dela no dia a dia. */
export async function clearSetsCache(): Promise<void> {
  await AsyncStorage.removeItem(SETS_KEY);
}

// ─── Procura de cartas (Fase 3) ──────────────────────────────────────────────

const CARDS_KEY = 'mtgrecall.scryfall.cards';

/**
 * Validade de uma procura em cache.
 *
 * Um dia e não sete como os sets: ao contrário da lista de sets, o que uma procura devolve muda
 * quando sai uma colecção nova, e o custo de errar é não encontrar uma carta acabada de sair.
 */
const CARD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type CardsSource = 'network' | 'cache' | 'none';

export interface CardSearchResult {
  cards: ScryfallCard[];
  source: CardsSource;
  /** O que dizer ao utilizador quando não veio da rede. `undefined` quando correu tudo bem. */
  message?: string;
}

async function readCardCache(): Promise<CardCache> {
  try {
    const raw = await AsyncStorage.getItem(CARDS_KEY);
    if (!raw) return emptyCardCache();
    const parsed = JSON.parse(raw);
    return isCardCache(parsed) ? parsed : emptyCardCache();
  } catch {
    // Uma cache ilegível é o mesmo que não haver cache — nunca uma razão para a procura falhar.
    return emptyCardCache();
  }
}

async function writeCardCache(cache: CardCache): Promise<void> {
  try {
    await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(cache));
  } catch (error) {
    // Sem cache a app funciona, só volta a pedir à rede. Não vale a pena estragar a procura por isto.
    console.warn('[scryfall] Não foi possível guardar a cache de cartas:', error);
  }
}

/**
 * Procura cartas pelo nome.
 *
 * **Nunca atira.** Sem rede devolve o que houver em cache e diz que está offline; sem cache devolve
 * vazio com uma mensagem. Acrescentar uma carta escrevendo o nome à mão continua a funcionar sempre
 * — o schema só exige `name` e `quantity` — e é isso que mantém a app utilizável numa loja sem sinal.
 */
export async function searchCards(query: string): Promise<CardSearchResult> {
  if (!isSearchableQuery(query)) return { cards: [], source: 'none' };

  const normalized = normalizeQuery(query);
  const cache = await readCardCache();

  const cached = readCachedQuery(cache, normalized, CARD_MAX_AGE_MS);
  if (cached) return { cards: cached, source: 'cache' };

  try {
    const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(normalized)}&unique=cards`;
    const cards = normalizeCardSearch(await scryfallFetch(url, 'the card search'));

    await writeCardCache(rememberQuery(cache, normalized, cards));
    return { cards, source: 'network' };
  } catch (error) {
    // Sem rede, o que já foi procurado antes continua a servir. Procura por substring sobre as
    // cartas que a cache já tem, que é o melhor que dá para fazer sem sinal.
    const offline = searchCachedCards(cache, normalized);
    return offline.length > 0
      ? { cards: offline, source: 'cache', message: 'Offline — showing cards you looked up before.' }
      : {
          cards: [],
          source: 'none',
          message:
            error instanceof Error && /respondeu/.test(error.message)
              ? 'Scryfall is not answering. You can still add the card by name.'
              : 'No connection. You can still add the card by name.',
        };
  }
}

export async function clearCardCache(): Promise<void> {
  await AsyncStorage.removeItem(CARDS_KEY);
}

// ─── Completar cartas lidas só pelo nome (ADR 0009) ──────────────────────────

/** O `POST /cards/collection` aceita 75 identificadores por pedido. */
const COLLECTION_BATCH = 75;

export interface ResolveResult {
  /** Chave de `cardNameKey` → a carta da Scryfall. */
  found: Map<string, ScryfallCard>;
  /** Os nomes que a Scryfall não reconheceu. Ficam como estão, e mostram-se. */
  notFound: string[];
  /** Porque é que não foi possível perguntar. `undefined` quando correu bem. */
  message?: string;
}

/**
 * Vai buscar à Scryfall os dados a sério das cartas que só têm nome.
 *
 * Uma decklist lida de uma fotografia traz nomes e mais nada. Sem `typeLine` não há agrupamento por
 * tipo, sem `cmc` não há curva de mana e sem `artCropUrl` não há arte — o deck fica registado mas
 * não se pode analisar, que é metade da razão de o registar.
 *
 * Um pedido por cada 75 cartas, e não um por carta: um deck de Limited resolve-se num pedido só,
 * um Commander em dois. Cem pedidos seguidos a 100 ms seriam dez segundos de espera e um convite a
 * que a Scryfall nos feche a porta.
 *
 * **Nunca atira.** Sem rede devolve o que tiver e explica; as cartas ficam com o nome, que é o que
 * a app sempre aceitou. É a promessa do offline-first: numa loja sem sinal o deck entra na mesma, e
 * completa-se depois.
 */
/**
 * Completa cartas cuja impressão já está escolhida, perguntando **pelo id**.
 *
 * Volta sempre a mesma impressão e não outra com o mesmo nome — é o que permite completar um deck
 * antigo (por exemplo, cartas gravadas antes de o `setCode` existir) sem lhe trocar as cartas por
 * baixo. Nunca atira: sem rede devolve o que tiver.
 */
export async function resolveCardPrintings(ids: string[]): Promise<Map<string, ScryfallCard>> {
  const byId = new Map<string, ScryfallCard>();
  const wanted = ids.map(id => id.trim()).filter(Boolean);
  if (wanted.length === 0) return byId;

  try {
    for (let start = 0; start < wanted.length; start += COLLECTION_BATCH) {
      const batch = wanted.slice(start, start + COLLECTION_BATCH);
      const payload = (await scryfallPost(
        'https://api.scryfall.com/cards/collection',
        { identifiers: batch.map(id => ({ id })) },
        'the printing data',
      )) as { data?: unknown[] };

      for (const raw of payload.data ?? []) {
        const card = normalizeCard(raw);
        if (card) byId.set(card.scryfallId, card);
      }
    }
  } catch {
    // Sem rede não se completa nada, e está bem assim: as cartas continuam a servir como estão.
  }

  return byId;
}

/**
 * Uma volta ao `POST /cards/collection`, em porções de 75. Devolve o que a Scryfall não conheceu.
 *
 * Pergunta pela colecção quando ela é conhecida: `{ name, set }` traz a impressão que se jogou, e
 * `{ name }` sozinho traz a que a Scryfall escolher — que é outra carta com o mesmo nome e o
 * símbolo de set errado ao lado dele.
 */
async function askForCards(
  queries: CardQuery[],
  found: Map<string, ScryfallCard>,
): Promise<CardQuery[]> {
  const missing: CardQuery[] = [];

  for (let start = 0; start < queries.length; start += COLLECTION_BATCH) {
    const batch = queries.slice(start, start + COLLECTION_BATCH);

    const payload = (await scryfallPost(
      'https://api.scryfall.com/cards/collection',
      {
        identifiers: batch.map(query =>
          query.setCode ? { name: query.name, set: query.setCode } : { name: query.name },
        ),
      },
      'the card data',
    )) as { data?: unknown[]; not_found?: { name?: string; set?: string }[] };

    for (const raw of payload.data ?? []) {
      const card = normalizeCard(raw);
      // A chave é a do **nome devolvido**: é por ele que `completeFromCatalogue` procura, depois
      // de normalizar o que o OCR leu.
      if (card) found.set(cardNameKey(card.name), card);
    }

    for (const entry of payload.not_found ?? []) {
      const name = entry?.name?.trim();
      if (name) missing.push({ name, setCode: entry?.set?.trim() || undefined });
    }
  }

  return missing;
}

export async function resolveCardNames(queries: CardQuery[]): Promise<ResolveResult> {
  const found = new Map<string, ScryfallCard>();

  const wanted = queries
    .map(query => ({
      name: query.name.trim(),
      setCode: query.setCode?.trim().toLowerCase() || undefined,
    }))
    .filter(query => query.name.length > 0);

  if (wanted.length === 0) return { found, notFound: [] };

  try {
    const missing = await askForCards(wanted, found);

    // Segunda volta. O que falhou a trazer colecção pode ter falhado **por causa dela** — um
    // `setCode` escrito à mão que está errado, ou uma carta que existe mas não nessa colecção.
    // Volta a perguntar-se só pelo nome, que é o que a app fazia antes de a colecção viajar junto:
    // é melhor completar uma carta com a impressão errada do que não a completar de todo.
    const byNameOnly = missing.filter(query => query.setCode).map(query => ({ name: query.name }));
    const stillMissing = byNameOnly.length > 0 ? await askForCards(byNameOnly, found) : [];

    return {
      found,
      notFound: [
        ...missing.filter(query => !query.setCode).map(query => query.name),
        ...stillMissing.map(query => query.name),
      ],
    };
  } catch (error) {
    return {
      found,
      notFound: [],
      message:
        error instanceof Error && /respondeu/.test(error.message)
          ? 'Scryfall is not answering — cards keep the names they were read with.'
          : 'No connection — cards keep the names they were read with.',
    };
  }
}

// ─── Terrenos básicos com a arte da colecção do deck ─────────────────────────

const BASICS_KEY = 'mtgrecall.scryfall.basics';

/** Sobe quando a forma desta cache mudar, para uma app nova não ler o que uma antiga escreveu. */
const BASICS_CACHE_VERSION = 2;

/** Colecções lembradas. Cada uma são poucas cartas — quarenta cabem à vontade. */
const MAX_CACHED_BASIC_SETS = 40;

interface BasicsCache {
  version: number;
  /** Código da colecção → as impressões dela. Uma lista vazia quer dizer "não tem básicos". */
  sets: Record<string, { fetchedAt: number; cards: ScryfallCard[] }>;
}

function emptyBasicsCache(): BasicsCache {
  return { version: BASICS_CACHE_VERSION, sets: {} };
}

async function readBasicsCache(): Promise<BasicsCache> {
  try {
    const raw = await AsyncStorage.getItem(BASICS_KEY);
    if (!raw) return emptyBasicsCache();

    const cache = JSON.parse(raw) as BasicsCache;
    if (cache.version !== BASICS_CACHE_VERSION || !cache.sets || typeof cache.sets !== 'object') {
      return emptyBasicsCache();
    }
    return cache;
  } catch {
    return emptyBasicsCache();
  }
}

async function writeBasicsCache(cache: BasicsCache): Promise<void> {
  // As colecções mais velhas caem primeiro. Sem tecto isto crescia a cada deck de uma colecção
  // nova, e o AsyncStorage do Android não é infinito.
  const codes = Object.keys(cache.sets).sort(
    (a, b) => (cache.sets[b]?.fetchedAt ?? 0) - (cache.sets[a]?.fetchedAt ?? 0),
  );

  const trimmed: BasicsCache = { version: BASICS_CACHE_VERSION, sets: {} };
  for (const code of codes.slice(0, MAX_CACHED_BASIC_SETS)) trimmed.sets[code] = cache.sets[code];

  try {
    await AsyncStorage.setItem(BASICS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.warn('[scryfall] não foi possível guardar a cache dos básicos:', error);
  }
}

/**
 * **Todas** as impressões de terrenos básicos de uma colecção.
 *
 * Pede tudo e não só os seis nomes de propósito, por duas razões que puxam para o mesmo lado.
 * Muitas colecções trazem duas versões do mesmo básico — a normal e a *full art* — e o selector das
 * definições precisa das duas para as poder mostrar lado a lado. E a cache fica completa à
 * primeira: o deck seguinte, que talvez precise da Montanha, já não vai à rede.
 *
 * `unique=prints` é o que faz a Scryfall devolver cada arte em vez de uma carta por nome.
 *
 * A cache **não tem validade**. As impressões de uma colecção já publicada não mudam mais; uma
 * validade só faria voltar à rede para receber a mesma resposta.
 *
 * Uma colecção **sem** básicos (há muitas) guarda-se como lista vazia, e é isso que impede a app de
 * perguntar outra vez de cada vez que se abre o deck — a Scryfall responde 404 a uma procura sem
 * resultados, e o portão já trata disso como lista vazia e não como avaria. Uma falha de rede, essa,
 * não se guarda: um minuto sem sinal não pode apagar a arte para sempre.
 *
 * **Nunca atira.** Sem rede devolve o que houver em cache, ou nada — e nada é como era antes de isto
 * existir: o básico fica com o placeholder.
 */
export async function loadBasicLandPrintings(setCode: string): Promise<ScryfallCard[]> {
  const code = setCode.trim().toLowerCase();
  if (!code) return [];

  const cache = await readBasicsCache();
  const cached = cache.sets[code];
  if (cached) return cached.cards;

  let cards: ScryfallCard[];
  try {
    // Uma colecção não tem mais básicos do que uma página (175). Se algum dia tiver, ficam os
    // primeiros — e os primeiros são os que interessam, que a ordem é a do número de coleccionador.
    const query = encodeURIComponent(`set:${code} type:basic`);
    const payload = await scryfallFetch(
      `https://api.scryfall.com/cards/search?q=${query}&unique=prints&order=set`,
      'the basic lands for that set',
    );
    cards = normalizeCardSearch(payload);
  } catch {
    // Sem rede fica como estava. Não se guarda nada: a colecção pode muito bem ter básicos.
    return [];
  }

  cache.sets[code] = { fetchedAt: Date.now(), cards };
  await writeBasicsCache(cache);

  return cards;
}

/**
 * Uma impressão por básico, para uma colecção.
 *
 * `chosen` é a escolha guardada nas definições (nome em minúsculas → `scryfallId`); sem ela vale a
 * primeira impressão de cada básico, que é a normal na esmagadora maioria das colecções.
 */
export async function resolveBasicLands(
  setCode: string,
  chosen?: Record<string, string>,
): Promise<Map<string, BasicLandPrinting>> {
  return chooseBasicLandPrintings(await loadBasicLandPrintings(setCode), chosen);
}
