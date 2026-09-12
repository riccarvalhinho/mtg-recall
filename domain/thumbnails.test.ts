import { describe, expect, it } from 'vitest';
import { deckThumbnailUrl, eventThumbnailUrl, thumbnailChoices, thumbnailUrls } from './thumbnails';
import type { Deck, DeckCard, Event } from '../types';

function card(name: string, scryfallId?: string, artCropUrl?: string): DeckCard {
  return { name, quantity: 1, scryfallId, artCropUrl };
}

function deck(id: string, cards: DeckCard[], thumbnailCardId?: string): Deck {
  return { id, name: id, colors: { main: [], splash: [] }, cards, thumbnailCardId };
}

function event(id: string, deckId?: string, deckThumbnailCardId?: string): Event {
  return {
    id,
    name: id,
    type: 'Modern',
    date: '2026-01-01',
    status: 'completed',
    deckId,
    deckThumbnailCardId,
    matches: [],
  };
}

const arte = [card('Alpha', 'a', 'http://art/a.jpg'), card('Beta', 'b', 'http://art/b.jpg')];

describe('deckThumbnailUrl', () => {
  it('usa a carta escolhida', () => {
    expect(deckThumbnailUrl(deck('d', arte, 'b'))).toBe('http://art/b.jpg');
  });

  it('sem escolha, usa a primeira carta com arte', () => {
    expect(deckThumbnailUrl(deck('d', arte))).toBe('http://art/a.jpg');
  });

  it('uma escolha que aponta para uma carta já removida trata-se como escolha nenhuma', () => {
    // A carta 'z' foi escolhida e depois tirada do deck. Cair para a primeira é melhor do que
    // devolver nada e mostrar um rectângulo cinzento num deck que tem artes.
    expect(deckThumbnailUrl(deck('d', arte, 'z'))).toBe('http://art/a.jpg');
  });

  it('um deck sem cartas não tem arte', () => {
    expect(deckThumbnailUrl(deck('d', []))).toBeUndefined();
  });

  it('cartas escritas à mão, sem arte, não dão miniatura', () => {
    expect(deckThumbnailUrl(deck('d', [card('Só nome')]))).toBeUndefined();
  });

  it('salta as cartas sem arte para encontrar a primeira que tem', () => {
    const misto = [card('Sem arte'), card('Com arte', 'x', 'http://art/x.jpg')];
    expect(deckThumbnailUrl(deck('d', misto))).toBe('http://art/x.jpg');
  });

  it('um deck indefinido não rebenta', () => {
    expect(deckThumbnailUrl(undefined)).toBeUndefined();
  });
});

describe('eventThumbnailUrl', () => {
  const decks = [deck('izzet', arte, 'a')];

  it('a escolha do evento manda sobre a do deck', () => {
    // Dois torneios com o mesmo deck podem querer ilustrações diferentes.
    expect(eventThumbnailUrl(event('e', 'izzet', 'b'), decks)).toBe('http://art/b.jpg');
  });

  it('sem escolha própria, herda a do deck', () => {
    expect(eventThumbnailUrl(event('e', 'izzet'), decks)).toBe('http://art/a.jpg');
  });

  it('um evento sem deckId não tem por onde ir buscar arte', () => {
    // São os eventos anteriores à Fase 2.
    expect(eventThumbnailUrl(event('legado'), decks)).toBeUndefined();
  });

  it('um deckId que já não existe não rebenta', () => {
    expect(eventThumbnailUrl(event('e', 'apagado'), decks)).toBeUndefined();
  });
});

describe('thumbnailChoices', () => {
  it('devolve as cartas com id e arte, pela ordem da lista', () => {
    expect(thumbnailChoices(arte)).toEqual([
      { scryfallId: 'a', name: 'Alpha', artCropUrl: 'http://art/a.jpg' },
      { scryfallId: 'b', name: 'Beta', artCropUrl: 'http://art/b.jpg' },
    ]);
  });

  it('deixa de fora as cartas escritas à mão', () => {
    // Sem `scryfallId` não há o que gravar, e sem `artCropUrl` não há o que desenhar.
    const lista = [card('Só nome'), card('Sem arte', 'x'), card('Com arte', 'y', 'http://art/y.jpg')];
    expect(thumbnailChoices(lista).map(choice => choice.scryfallId)).toEqual(['y']);
  });

  it('a mesma carta no main e no sideboard é uma escolha só', () => {
    const main = card('Alpha', 'a', 'http://art/a.jpg');
    const side = { ...card('Alpha', 'a', 'http://art/a.jpg'), board: 'side' as const };
    expect(thumbnailChoices([main, side])).toHaveLength(1);
  });

  it('apara o nome', () => {
    expect(thumbnailChoices([card('  Alpha  ', 'a', 'http://art/a.jpg')])[0].name).toBe('Alpha');
  });

  it('um deck sem cartas não dá escolhas — é o sinal de que o selector não aparece', () => {
    expect(thumbnailChoices(undefined)).toEqual([]);
    expect(thumbnailChoices([])).toEqual([]);
  });
});

describe('thumbnailUrls', () => {
  it('junta as dos decks e as dos eventos, sem repetições', () => {
    const decks = [deck('izzet', arte, 'a')];
    const events = [event('e1', 'izzet', 'b'), event('e2', 'izzet', 'b')];

    const urls = thumbnailUrls(decks, events);
    expect(urls.sort()).toEqual(['http://art/a.jpg', 'http://art/b.jpg']);
  });

  it('não traz as artes todas da decklist — só as miniaturas', () => {
    // Um deck de cem cartas dá UMA miniatura. Descarregar as cem por antecipação seria gastar
    // dados por uma coisa que só se vê ao abrir o deck.
    const cem = Array.from({ length: 100 }, (_, i) => card(`C${i}`, `id${i}`, `http://art/${i}.jpg`));
    expect(thumbnailUrls([deck('grande', cem)], [])).toHaveLength(1);
  });

  it('sem nada devolve lista vazia', () => {
    expect(thumbnailUrls([], [])).toEqual([]);
  });
});
