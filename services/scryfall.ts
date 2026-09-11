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
import { normalizeSets, type MtgSet } from '../domain/sets';

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

/** Um pedido de cada vez, com o intervalo mínimo respeitado. */
async function fetchSetsFromNetwork(): Promise<MtgSet[]> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const since = Date.now() - lastRequestAt;
    if (since < MIN_INTERVAL_MS) await wait(MIN_INTERVAL_MS - since);
    lastRequestAt = Date.now();

    // A Scryfall pede um User-Agent que a identifique — é a única forma de ela saber quem está a
    // bater à porta quando alguma coisa corre mal do lado dela.
    const response = await fetch(SETS_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'MTGRecall/1.0' },
    });

    if (!response.ok) {
      throw new Error(`A Scryfall respondeu ${response.status} ao pedir os sets.`);
    }

    return normalizeSets(await response.json());
  })();

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
        error: 'A Scryfall não devolveu nenhum set utilizável.',
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
