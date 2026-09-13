/**
 * Cartas da Scryfall — a parte que decide, sem rede nenhuma.
 *
 * Quem fala com a API e quem guarda a cache é `services/scryfall.ts`; a forma da cache está em
 * `domain/cardCache.ts`. Aqui só há funções puras: ler a resposta crua da Scryfall, transformá-la
 * numa carta que a app entende, e transformar essa carta numa linha de deck. Testa-se sem simular
 * rede nenhuma (`cards.test.ts`), pelo mesmo princípio de `domain/sets.ts`.
 *
 * ## Porque é que os campos são copiados
 *
 * Uma `DeckCard` leva `manaCost`, `cmc`, `typeLine` e `colors` para dentro do ficheiro do deck de
 * propósito — ver data/schema/deck.schema.json. Os dados de uma impressão não mudam, e copiá-los
 * deixa o Deck Analyser funcionar numa loja sem rede, que é a regra 3 do projecto.
 */
import type { CardRarity, DeckBoard, DeckCard, ManaColor } from '../types';

/** As cinco cores, pela ordem WUBRG. A mesma ordem de `domain/deck.ts` e do schema. */
const MANA_COLORS: readonly ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

/**
 * O que a app precisa de uma carta.
 *
 * A Scryfall devolve setenta e tal campos por carta; guardar tudo era encher a cache com legalidade
 * em Pauper e rankings de EDHREC que ninguém aqui lê.
 */
export interface ScryfallCard {
  /** Id da impressão. É isto que vai para `scryfallId` e, mais tarde, para a colecção. */
  scryfallId: string;
  name: string;
  /** Notação Scryfall, ex.: `{1}{U}{U}`. Ausente em cartas sem custo (terrenos). */
  manaCost?: string;
  cmc?: number;
  typeLine?: string;
  colors?: ManaColor[];
  /** Código do set, minúsculas. Serve para distinguir impressões na lista de resultados. */
  setCode?: string;
  /** Raridade, para colorir o símbolo do set. */
  rarity?: CardRarity;
  collectorNumber?: string;
  /** Imagem pequena, para a lista de resultados. Não vai para o ficheiro do deck. */
  imageUrl?: string;
  /**
   * Recorte da arte, sem moldura nem texto. É o que a decklist mostra à esquerda de cada linha.
   *
   * Vai para o ficheiro do deck, ao contrário do `imageUrl`: é a única das imagens que a app
   * desenha a partir dos dados guardados, e pedi-la à Scryfall de cada vez que se abre um deck
   * seria rede a mais para uma coisa que não muda.
   */
  artCropUrl?: string;
}

/**
 * Uma carta escrita à mão, sem passar pela Scryfall.
 *
 * Existe porque o campo de procura tem de continuar a servir sem rede e sem cache: o schema só
 * exige `name` e `quantity`, e uma lista escrita à mão é melhor do que lista nenhuma. O Deck
 * Analyser é que não a consegue contar — não tem `cmc` nem `typeLine` — e isso é dito no écran.
 */
export interface ManualCard {
  name: string;
}

/** O que sai do campo de procura: ou uma carta da Scryfall, ou um nome escrito à mão. */
export type PickedCard = ScryfallCard | ManualCard;

export function isScryfallCard(card: PickedCard): card is ScryfallCard {
  return typeof (card as ScryfallCard).scryfallId === 'string';
}

/** Abaixo disto a Scryfall devolve meio catálogo e a lista não ajuda ninguém. */
export const MIN_QUERY_LENGTH = 2;

/** Espaços a mais são engano de teclado, não intenção. */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

/** Se vale a pena ir à rede. Um caracteres só não é uma procura, é um engano. */
export function isSearchableQuery(query: string): boolean {
  return normalizeQuery(query).length >= MIN_QUERY_LENGTH;
}

/** A forma crua de uma carta na resposta da Scryfall. Só os campos que lemos. */
interface RawCardFace {
  mana_cost?: unknown;
  type_line?: unknown;
  colors?: unknown;
  image_uris?: unknown;
}

interface RawCard {
  id?: unknown;
  name?: unknown;
  mana_cost?: unknown;
  cmc?: unknown;
  type_line?: unknown;
  colors?: unknown;
  set?: unknown;
  rarity?: unknown;
  collector_number?: unknown;
  image_uris?: unknown;
  card_faces?: unknown;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/** Só WUBRG, sem repetições e pela ordem do schema — `uniqueItems` chumbaria o resto. */
function manaColors(value: unknown): ManaColor[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const found = MANA_COLORS.filter(color => value.includes(color));
  return found.length > 0 ? found : undefined;
}

function faces(value: unknown): RawCardFace[] {
  return Array.isArray(value) ? (value as RawCardFace[]).filter(face => face && typeof face === 'object') : [];
}

/** A imagem pequena de um objecto `image_uris`. */
function smallImage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const uris = value as Record<string, unknown>;
  return text(uris.small) ?? text(uris.normal) ?? text(uris.png);
}

/**
 * O recorte da arte de um objecto `image_uris`.
 *
 * Sem alternativa: se não houver `art_crop`, não há recorte. Cair para a carta inteira daria uma
 * linha com a moldura e o texto todo espremidos em 44 píxeis, que é pior do que o placeholder.
 */
function artCrop(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return text((value as Record<string, unknown>).art_crop);
}

/**
 * Uma carta crua da Scryfall, na forma que a app usa. `null` quando não dá para aproveitar.
 *
 * **Cartas de duas faces** não trazem `mana_cost` nem `colors` no topo — vêm dentro de
 * `card_faces`. Gravar os campos vazios punha uma Delver of Secrets na barra do zero da curva e
 * fora da distribuição de cores, que é exactamente o contrário do que ela é. Por isso as faces são
 * juntas: o custo com ` // ` pelo meio, como a Scryfall o escreve, e as cores em união.
 */
/** As raridades que o schema aceita. Uma que não conheçamos fica de fora em vez de o chumbar. */
const RARITIES: CardRarity[] = ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus'];

function rarityOf(raw: unknown): CardRarity | undefined {
  const value = typeof raw === 'string' ? raw.toLowerCase() : '';
  return RARITIES.find(rarity => rarity === value);
}

export function normalizeCard(raw: unknown): ScryfallCard | null {
  if (!raw || typeof raw !== 'object') return null;

  const entry = raw as RawCard;
  const scryfallId = text(entry.id);
  const name = text(entry.name);
  if (!scryfallId || !name) return null;

  const cardFaces = faces(entry.card_faces);

  const manaCost =
    text(entry.mana_cost) ??
    (cardFaces.map(face => text(face.mana_cost)).filter(Boolean).join(' // ') || undefined);

  const typeLine =
    text(entry.type_line) ??
    (cardFaces.map(face => text(face.type_line)).filter(Boolean).join(' // ') || undefined);

  const colors =
    manaColors(entry.colors) ??
    manaColors(cardFaces.flatMap(face => (Array.isArray(face.colors) ? face.colors : [])));

  // `cmc` é sempre do lado de fora, mesmo nas cartas de duas faces — e um valor negativo ou NaN
  // seria chumbado pelo schema (`minimum: 0`), por isso fica de fora em vez de ir na mesma.
  const cmc =
    typeof entry.cmc === 'number' && Number.isFinite(entry.cmc) && entry.cmc >= 0
      ? entry.cmc
      : undefined;

  return {
    scryfallId,
    name,
    manaCost,
    cmc,
    typeLine,
    colors,
    setCode: text(entry.set)?.toLowerCase(),
    rarity: rarityOf(entry.rarity),
    collectorNumber: text(entry.collector_number),
    imageUrl: smallImage(entry.image_uris) ?? smallImage(cardFaces[0]?.image_uris),
    // Numa carta de duas faces, a arte que representa o deck é a da frente.
    artCropUrl: artCrop(entry.image_uris) ?? artCrop(cardFaces[0]?.image_uris),
  };
}

/**
 * A resposta de `/cards/search`, já filtrada.
 *
 * Aceita `unknown` porque é isso que um `response.json()` é. Uma carta estranha fica de fora e as
 * outras seguem — o mesmo princípio de `normalizeSets`.
 */
export function normalizeCardSearch(payload: unknown): ScryfallCard[] {
  const data = (payload as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];

  const cards: ScryfallCard[] = [];
  const seen = new Set<string>();

  for (const entry of data) {
    const card = normalizeCard(entry);
    if (!card || seen.has(card.scryfallId)) continue;
    seen.add(card.scryfallId);
    cards.push(card);
  }

  return cards;
}

/**
 * A linha de deck que corresponde a uma carta escolhida.
 *
 * Uma carta escrita à mão leva só nome e quantidade: é o mínimo que o schema exige, e inventar um
 * `cmc` a zero era pior do que não ter nenhum — ver `manaCurve` em `domain/deck.ts`.
 */
export function toDeckCard(card: PickedCard, quantity: number, board: DeckBoard = 'main'): DeckCard {
  const entry: DeckCard = {
    name: card.name.trim(),
    quantity,
    board: board === 'side' ? 'side' : undefined,
  };

  if (!isScryfallCard(card)) return entry;

  return {
    ...entry,
    scryfallId: card.scryfallId,
    setCode: card.setCode,
    rarity: card.rarity,
    manaCost: card.manaCost,
    cmc: card.cmc,
    typeLine: card.typeLine,
    colors: card.colors,
    artCropUrl: card.artCropUrl,
  };
}

/** Um nome escrito à mão só serve se sobrar alguma coisa depois de aparado (schema: `minLength: 1`). */
export function isValidCardName(name: string): boolean {
  return name.trim().length > 0;
}

/** O que se guarda quando o nome foi escrito à mão. `null` quando não sobra nome nenhum. */
export function toManualCard(name: string): ManualCard | null {
  const trimmed = name.trim();
  return trimmed.length > 0 ? { name: trimmed } : null;
}

// ─── Completar cartas que só têm nome ─────────────────────────────────────────

/**
 * A chave por que se casa um nome lido com uma carta do catálogo.
 *
 * Minúsculas, sem acentos e sem pontuação: o OCR come apóstrofos e vírgulas, e "Bilbo's Deadly
 * Slice" tem de bater certo com "Bilbos deadly slice". É a mesma normalização que o
 * `domain/ocrDecklist.ts` usa para comparar — aqui só não há tolerância a erros, porque quem
 * responde é a Scryfall e ela já faz a procura difusa do lado dela.
 */
export function cardNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // O apóstrofo **desaparece**, em vez de virar espaço: o OCR tanto lê "Bilbo's" como "Bilbos",
    // e se um deles ficasse "bilbo s" e o outro "bilbos" nunca se encontravam. O resto da
    // pontuação vira espaço, que é o que separa palavras a sério.
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Preenche as cartas que só têm nome com os dados a sério.
 *
 * Uma carta acrescentada pelo nome — escrita à mão ou lida de uma fotografia — entra com `name` e
 * `quantity` e mais nada. Sem `typeLine` não há agrupamento por tipo, sem `cmc` não há curva de
 * mana, sem `artCropUrl` não há arte: o deck fica registado mas não se pode analisar, que é metade
 * da razão de o registar.
 *
 * O que **não** se toca: a quantidade e o board são do utilizador, e ficam. E uma carta que já
 * tenha `scryfallId` passa incólume — já foi escolhida uma impressão concreta, e substituí-la por
 * outra só porque o nome bate certo seria desfazer uma decisão que alguém tomou.
 *
 * O nome passa a ser o da Scryfall: se o OCR leu "Dori, Bearer of friends" com f minúsculo, é a
 * grafia certa que fica.
 */
export function completeFromCatalogue(
  cards: DeckCard[],
  found: Map<string, ScryfallCard>,
): DeckCard[] {
  return cards.map(card => {
    if (card.scryfallId) return card;

    const match = found.get(cardNameKey(card.name));
    if (!match) return card;

    return {
      // `board` mantém-se: mudar uma carta do sideboard para o main ao completá-la seria mexer
      // numa decisão do utilizador a pretexto de lhe preencher o tipo.
      ...toDeckCard(match, card.quantity, card.board === 'side' ? 'side' : 'main'),
      quantity: card.quantity,
    };
  });
}

/**
 * Uma carta cuja impressão já está escolhida mas a quem falta informação.
 *
 * Acontece a quem gravou um deck antes de um campo existir — o `setCode` é o caso: as cartas têm
 * `scryfallId` e mesmo assim não sabem de que set são. Estas resolvem-se **pelo id** e não pelo
 * nome, o que garante que volta a mesma impressão e não outra qualquer com o mesmo nome.
 */
export function printingsToRefresh(cards: DeckCard[]): string[] {
  const ids = new Set<string>();

  for (const card of cards) {
    if (!card.scryfallId) continue;
    if (card.setCode && card.typeLine && card.rarity) continue;
    ids.add(card.scryfallId);
  }

  return [...ids];
}

/**
 * Preenche o que falta às cartas cuja impressão já está escolhida.
 *
 * Ao contrário do `completeFromCatalogue`, aqui a carta não muda de identidade: é a mesma impressão,
 * só com os campos que faltavam. Por isso a quantidade, o board **e o id** ficam como estão.
 */
export function completeFromPrintings(
  cards: DeckCard[],
  byId: Map<string, ScryfallCard>,
): DeckCard[] {
  return cards.map(card => {
    if (!card.scryfallId) return card;

    const printing = byId.get(card.scryfallId);
    if (!printing) return card;

    return {
      ...toDeckCard(printing, card.quantity, card.board === 'side' ? 'side' : 'main'),
      quantity: card.quantity,
    };
  });
}

/** As cartas da lista que ainda só têm nome — as que vale a pena ir perguntar à Scryfall. */
export function namesToResolve(cards: DeckCard[]): string[] {
  const names = new Set<string>();

  for (const card of cards) {
    if (card.scryfallId) continue;
    const name = card.name?.trim();
    if (name) names.add(name);
  }

  return [...names];
}
