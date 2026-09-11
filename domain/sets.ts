/**
 * Sets de Magic — a parte que decide, sem rede nenhuma.
 *
 * A Scryfall devolve mais de mil sets, e a maioria não é jogável num torneio: promos, decks de
 * oferta, memorabilia, sets só digitais. Escolher de uma lista dessas seria pior do que escrever o
 * código à mão, que é o que isto vem substituir.
 *
 * Quem fala com a Scryfall e quem guarda a cache é `services/scryfall.ts`. Aqui só há funções puras
 * — filtrar, ordenar, procurar, validar — e por isso testam-se sem simular rede (`sets.test.ts`).
 */

/** O que a app precisa de um set. A resposta da Scryfall traz muito mais; guardar tudo era encher a cache por nada. */
export interface MtgSet {
  /** Código Scryfall, ex.: `dft`. É isto que vai para o campo `setCode` do evento. */
  code: string;
  name: string;
  /** AAAA-MM-DD. Ordenar por texto chega, porque o formato é fixo. */
  releasedAt: string;
  setType: string;
}

/**
 * Os tipos de set que interessam a um torneio.
 *
 * `core` e `expansion` são o Standard e o Limited normal; `masters` e `draft_innovation` (Jumpstart,
 * os Horizons, os Remastered) são sets desenhados para draft. Tudo o resto — promos, duel decks,
 * memorabilia — não se joga em Sealed nem em Draft.
 */
export const TOURNAMENT_SET_TYPES: readonly string[] = [
  'core',
  'expansion',
  'masters',
  'draft_innovation',
];

/**
 * O mesmo padrão que `setCode` tem em data/schema/event.schema.json.
 *
 * Está aqui repetido de propósito: um código que não case com isto é recusado pelo `npm run
 * validate` **depois** de o commit já estar feito, e por isso é filtrado antes de chegar ao écran.
 */
export const SET_CODE_PATTERN = /^[a-z0-9]{3,6}$/;

/** A forma crua de um set na resposta da Scryfall. Só os campos que lemos. */
interface RawScryfallSet {
  code?: unknown;
  name?: unknown;
  released_at?: unknown;
  set_type?: unknown;
  digital?: unknown;
}

/** Um set jogável em papel, com código que o schema aceita. */
export function isTournamentSet(set: MtgSet & { digital?: boolean }): boolean {
  if (set.digital) return false;
  if (!TOURNAMENT_SET_TYPES.includes(set.setType)) return false;
  if (!SET_CODE_PATTERN.test(set.code)) return false;
  // Um set sem data de saída não se consegue ordenar, e não há nenhum jogável nessas condições.
  return typeof set.releasedAt === 'string' && set.releasedAt.length > 0;
}

/**
 * Pega na resposta da Scryfall e devolve a lista que a app usa: só o que se joga, do mais recente
 * para o mais antigo.
 *
 * Aceita `unknown` porque é isso que um `response.json()` é. Um campo em falta não deita nada
 * abaixo — o set fica de fora e os outros seguem.
 */
export function normalizeSets(payload: unknown): MtgSet[] {
  const data = (payload as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];

  const sets: MtgSet[] = [];

  for (const entry of data as RawScryfallSet[]) {
    if (!entry || typeof entry !== 'object') continue;

    const candidate = {
      code: typeof entry.code === 'string' ? entry.code.toLowerCase() : '',
      name: typeof entry.name === 'string' ? entry.name : '',
      releasedAt: typeof entry.released_at === 'string' ? entry.released_at : '',
      setType: typeof entry.set_type === 'string' ? entry.set_type : '',
      digital: entry.digital === true,
    };

    if (!candidate.name) continue;
    if (!isTournamentSet(candidate)) continue;

    sets.push({
      code: candidate.code,
      name: candidate.name,
      releasedAt: candidate.releasedAt,
      setType: candidate.setType,
    });
  }

  return sortSets(sets);
}

/** Mais recentes primeiro — é quase sempre o set de agora que se quer. O código desempata para a ordem ser estável. */
export function sortSets(sets: MtgSet[]): MtgSet[] {
  return [...sets].sort(
    (a, b) => b.releasedAt.localeCompare(a.releasedAt) || a.code.localeCompare(b.code),
  );
}

/** Minúsculas e sem acentos, para "Théros" encontrar "Theros". O mesmo princípio de `domain/slug.ts`. */
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Procura por nome ou por código. Um código escrito por inteiro sobe ao topo, porque quem escreve
 * "dft" já sabe o que quer.
 */
export function filterSets(sets: MtgSet[], query: string): MtgSet[] {
  const term = normalizeText(query);
  if (!term) return sets;

  const matches = sets.filter(
    set => normalizeText(set.name).includes(term) || set.code.includes(term),
  );

  const exact = matches.filter(set => set.code === term);
  if (exact.length === 0) return matches;
  return [...exact, ...matches.filter(set => set.code !== term)];
}

/** Um código escrito à mão só serve se o schema o aceitar. Usado pelo caminho de recurso, sem lista. */
export function isValidSetCode(code: string): boolean {
  return SET_CODE_PATTERN.test(code.trim().toLowerCase());
}

/** O que se guarda no evento: minúsculas, sem espaços. `undefined` quando não há nada que valha. */
export function toSetCode(input: string): string | undefined {
  const code = input.trim().toLowerCase();
  return isValidSetCode(code) ? code : undefined;
}

/** Só Sealed e Draft é que têm set — ver o schema: "Só faz sentido em Limited". */
export function isLimitedFormat(type: string): boolean {
  return type === 'Sealed' || type === 'Draft';
}
