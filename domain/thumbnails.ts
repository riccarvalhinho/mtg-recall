/**
 * Qual a arte que ilustra um deck ou um evento. Puro, sem I/O.
 *
 * Os schemas guardam um `scryfallId` (`Deck.thumbnailCardId`, `Event.deckThumbnailCardId`) e não um
 * URL. O URL sai da própria lista de cartas do deck, que já traz `artCropUrl` — sem pedidos à rede
 * e sem campo novo no ficheiro.
 *
 * Isto obriga a que a carta escolhida seja uma das cartas do deck, e é bom que obrigue: um deck é
 * ilustrado por uma carta que ele tem.
 */
import type { Deck, DeckCard, Event } from '../types';

/**
 * A arte que ilustra um deck.
 *
 * Se houver escolha explícita, é essa. Se não houver — ou se a carta escolhida já não estiver no
 * deck, porque foi removida depois de ser escolhida — cai para a primeira carta com arte, por ordem
 * alfabética, que é a ordem em que a lista é gravada.
 *
 * O recurso existe para um deck com cartas nunca aparecer como um rectângulo cinzento só porque
 * ninguém se lembrou de escolher uma. Uma escolha que aponta para o vazio é tratada como escolha
 * nenhuma, e não como erro.
 */
export function deckThumbnailUrl(deck: Deck | undefined): string | undefined {
  const cards = deck?.cards ?? [];
  if (cards.length === 0) return undefined;

  if (deck?.thumbnailCardId) {
    const chosen = cards.find(card => card.scryfallId === deck.thumbnailCardId);
    if (chosen?.artCropUrl) return chosen.artCropUrl;
  }

  return cards.find(card => card.artCropUrl)?.artCropUrl;
}

/**
 * A arte que ilustra um evento.
 *
 * A escolha do evento manda sobre a do deck: dois torneios com o mesmo deck podem querer ilustrações
 * diferentes — a bomba que ganhou o primeiro não é a que ganhou o segundo. Sem escolha própria,
 * herda a do deck.
 *
 * Um evento sem `deckId` — os anteriores à Fase 2 — não tem por onde ir buscar arte nenhuma.
 */
export function eventThumbnailUrl(event: Event, decks: Deck[]): string | undefined {
  if (!event.deckId) return undefined;

  const deck = decks.find(entry => entry.id === event.deckId);
  if (!deck) return undefined;

  if (event.deckThumbnailCardId) {
    const chosen = (deck.cards ?? []).find(card => card.scryfallId === event.deckThumbnailCardId);
    if (chosen?.artCropUrl) return chosen.artCropUrl;
  }

  return deckThumbnailUrl(deck);
}

/** Uma carta do deck que pode ilustrá-lo: tem id da impressão e tem arte para mostrar. */
export interface ThumbnailChoice {
  scryfallId: string;
  name: string;
  artCropUrl: string;
}

/**
 * As cartas que podem ser escolhidas para ilustrar um deck.
 *
 * É a lista que o selector desenha, e a regra que a define é a mesma que torna a funcionalidade
 * possível sem rede: só entra quem tenha `scryfallId` (é isso que vai para o ficheiro) e
 * `artCropUrl` (é isso que se desenha). Uma carta escrita à mão não tem nem uma coisa nem outra,
 * portanto não entra — e num deck escrito todo à mão a lista sai vazia, que é o sinal de que o
 * selector não deve aparecer.
 *
 * Sem repetições: a mesma carta no main e no sideboard é uma escolha só, e duas iguais lado a lado
 * seriam dois botões indistinguíveis. Fica a primeira, que é a do main — a lista é gravada com o
 * main à frente.
 */
export function thumbnailChoices(cards: DeckCard[] | undefined): ThumbnailChoice[] {
  const choices: ThumbnailChoice[] = [];
  const seen = new Set<string>();

  for (const card of cards ?? []) {
    const name = card?.name?.trim();
    if (!name || !card.scryfallId || !card.artCropUrl) continue;
    if (seen.has(card.scryfallId)) continue;

    seen.add(card.scryfallId);
    choices.push({ scryfallId: card.scryfallId, name, artCropUrl: card.artCropUrl });
  }

  return choices;
}

/**
 * Todas as artes que vale a pena garantir em disco, sem repetições.
 *
 * São **só as miniaturas** e não as artes todas das decklists: um deck de Commander tem cem cartas
 * e descarregá-las por antecipação seria gastar dados por uma coisa que só se vê ao abrir o deck.
 * As da lista ficam em cache sozinhas à medida que os decks vão sendo abertos (ver a decisão da
 * cache no roadmap, Fase 5).
 */
export function thumbnailUrls(decks: Deck[], events: Event[]): string[] {
  const urls = new Set<string>();

  for (const deck of decks) {
    const url = deckThumbnailUrl(deck);
    if (url) urls.add(url);
  }

  for (const event of events) {
    const url = eventThumbnailUrl(event, decks);
    if (url) urls.add(url);
  }

  return [...urls];
}

/**
 * A carta inteira, em tamanho de leitura. `null` quando não há impressão concreta.
 *
 * O URL é **construído** a partir do `scryfallId`, pelo caminho documentado da Scryfall:
 * `cards.scryfall.io/<tamanho>/front/<1.ª letra>/<2.ª letra>/<id>.jpg`. Não se guarda no ficheiro
 * do deck porque se deduz. Vive aqui e não no `CardImageOverlay` para o relatório de evento, que é
 * lógica pura, o poder usar.
 */
export function cardImageUrl(scryfallId?: string): string | null {
  const id = scryfallId?.trim().toLowerCase();
  if (!id || id.length < 2) return null;
  return `https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/${id}.jpg`;
}
