import { describe, expect, it } from 'vitest';
import {
  cardNameKey,
  completeFromCatalogue,
  completeFromPrintings,
  isScryfallCard,
  isSearchableQuery,
  isValidCardName,
  normalizeCard,
  normalizeCardSearch,
  namesToResolve,
  normalizeQuery,
  printingsToRefresh,
  toDeckCard,
  toManualCard,
} from './cards.ts';
import type { ScryfallCard } from './cards.ts';
import type { DeckCard } from '../types';

/** Uma carta crua como a Scryfall a devolve, com o mínimo que interessa. */
function rawCard(overrides: Record<string, unknown> = {}) {
  return {
    id: '1f3c6c1e-0000-4000-8000-000000000001',
    name: 'Lightning Bolt',
    mana_cost: '{R}',
    cmc: 1,
    type_line: 'Instant',
    colors: ['R'],
    set: 'LEA',
    collector_number: '161',
    image_uris: { small: 'https://cards.scryfall.io/small/bolt.jpg' },
    ...overrides,
  };
}

function payload(...cards: Record<string, unknown>[]) {
  return { object: 'list', data: cards };
}

describe('normalizeCard', () => {
  it('guarda os campos que o ficheiro do deck precisa', () => {
    const card = normalizeCard(rawCard())!;

    expect(card).toMatchObject({
      scryfallId: '1f3c6c1e-0000-4000-8000-000000000001',
      name: 'Lightning Bolt',
      manaCost: '{R}',
      cmc: 1,
      typeLine: 'Instant',
      colors: ['R'],
      setCode: 'lea',
      collectorNumber: '161',
    });
  });

  it('recusa uma carta sem id ou sem nome', () => {
    // Sem id não há forma de a distinguir de outra impressão; sem nome o schema chumba-a.
    expect(normalizeCard(rawCard({ id: undefined }))).toBeNull();
    expect(normalizeCard(rawCard({ name: '  ' }))).toBeNull();
    expect(normalizeCard(null)).toBeNull();
  });

  it('junta as faces de uma carta de duas faces', () => {
    // Uma Delver of Secrets não tem mana_cost nem colors no topo: gravá-los vazios punha-a na barra
    // do zero da curva e fora da distribuição de cores.
    const card = normalizeCard(
      rawCard({
        name: 'Delver of Secrets // Insectile Aberration',
        mana_cost: undefined,
        colors: undefined,
        type_line: undefined,
        cmc: 1,
        card_faces: [
          { name: 'Delver of Secrets', mana_cost: '{U}', type_line: 'Creature — Human Wizard', colors: ['U'] },
          { name: 'Insectile Aberration', mana_cost: '', type_line: 'Creature — Human Insect', colors: ['U'] },
        ],
      }),
    )!;

    expect(card.manaCost).toBe('{U}');
    expect(card.typeLine).toBe('Creature — Human Wizard // Creature — Human Insect');
    expect(card.colors).toEqual(['U']);
    expect(card.cmc).toBe(1);
  });

  it('junta os custos e as cores das duas metades de uma carta split', () => {
    const card = normalizeCard(
      rawCard({
        name: 'Fire // Ice',
        mana_cost: undefined,
        colors: undefined,
        type_line: 'Instant // Instant',
        cmc: 4,
        card_faces: [
          { mana_cost: '{1}{R}', type_line: 'Instant', colors: ['R'] },
          { mana_cost: '{1}{U}', type_line: 'Instant', colors: ['U'] },
        ],
      }),
    )!;

    expect(card.manaCost).toBe('{1}{R} // {1}{U}');
    // WUBRG, sem repetições — é o que o schema aceita em `colors`.
    expect(card.colors).toEqual(['U', 'R']);
  });

  it('vai buscar a imagem à primeira face quando a carta não tem imagem no topo', () => {
    const card = normalizeCard(
      rawCard({
        image_uris: undefined,
        card_faces: [{ image_uris: { small: 'https://cards.scryfall.io/small/face.jpg' } }],
      }),
    )!;

    expect(card.imageUrl).toBe('https://cards.scryfall.io/small/face.jpg');
  });

  it('deixa de fora um custo vazio em vez de gravar uma string vazia', () => {
    // Um terreno não tem custo de mana. `manaCost: ''` no ficheiro era ruído no diff.
    const card = normalizeCard(rawCard({ name: 'Island', mana_cost: '', colors: [], cmc: 0 }))!;

    expect(card.manaCost).toBeUndefined();
    expect(card.colors).toBeUndefined();
    expect(card.cmc).toBe(0);
  });

  it('deixa de fora um cmc que o schema chumbaria', () => {
    expect(normalizeCard(rawCard({ cmc: -1 }))!.cmc).toBeUndefined();
    expect(normalizeCard(rawCard({ cmc: 'muito' }))!.cmc).toBeUndefined();
    // Meio ponto existe — é uma carta de Un-set, e o schema aceita-a (`minimum: 0`).
    expect(normalizeCard(rawCard({ cmc: 0.5 }))!.cmc).toBe(0.5);
  });

  it('deita fora cores que não são WUBRG', () => {
    expect(normalizeCard(rawCard({ colors: ['R', 'C', 'X'] }))!.colors).toEqual(['R']);
  });
});

describe('normalizeCardSearch', () => {
  it('lê a lista e deixa cair o que não se aproveita', () => {
    const cards = normalizeCardSearch(
      payload(rawCard(), rawCard({ id: undefined, name: 'Sem id' }), rawCard({ id: 'outro', name: 'Counterspell' })),
    );

    expect(cards.map(card => card.name)).toEqual(['Lightning Bolt', 'Counterspell']);
  });

  it('não repete a mesma impressão', () => {
    expect(normalizeCardSearch(payload(rawCard(), rawCard())).length).toBe(1);
  });

  it('devolve lista vazia quando a resposta não tem forma de lista', () => {
    expect(normalizeCardSearch({ object: 'error', status: 404 })).toEqual([]);
    expect(normalizeCardSearch(null)).toEqual([]);
  });
});

describe('normalizeQuery', () => {
  it('apara e junta espaços a mais', () => {
    expect(normalizeQuery('  lightning   bolt ')).toBe('lightning bolt');
  });

  it('uma letra só não é uma procura', () => {
    // Ir à Scryfall com "l" devolvia meio catálogo e não ajudava ninguém.
    expect(isSearchableQuery('l')).toBe(false);
    expect(isSearchableQuery('  ')).toBe(false);
    expect(isSearchableQuery('bo')).toBe(true);
  });
});

describe('toDeckCard', () => {
  it('copia os campos da Scryfall para a linha do deck', () => {
    const card = normalizeCard(rawCard())!;
    const entry = toDeckCard(card, 4);

    expect(entry).toEqual({
      name: 'Lightning Bolt',
      quantity: 4,
      board: undefined,
      scryfallId: card.scryfallId,
      // O set vem junto: é ele que dá o ícone ao lado do nome na decklist.
      setCode: card.setCode,
      manaCost: '{R}',
      cmc: 1,
      typeLine: 'Instant',
      colors: ['R'],
      artCropUrl: card.artCropUrl,
    });
  });

  it('marca o sideboard e deixa o main sem campo', () => {
    // Ausente significa main (schema): escrevê-lo dava ruído em todas as linhas do diff.
    expect(toDeckCard(normalizeCard(rawCard())!, 2, 'side').board).toBe('side');
    expect(toDeckCard(normalizeCard(rawCard())!, 2, 'main').board).toBeUndefined();
  });

  it('uma carta escrita à mão leva só nome e quantidade', () => {
    // Inventar um cmc a zero punha-a na barra da esquerda da curva como se fosse grátis.
    const entry = toDeckCard({ name: '  Sol Ring ' }, 1);

    expect(entry).toEqual({ name: 'Sol Ring', quantity: 1, board: undefined });
  });
});

describe('nomes escritos à mão', () => {
  it('um nome só de espaços não serve', () => {
    expect(isValidCardName('   ')).toBe(false);
    expect(toManualCard('   ')).toBeNull();
    expect(toManualCard('  Sol Ring ')).toEqual({ name: 'Sol Ring' });
  });

  it('distingue uma carta da Scryfall de um nome escrito à mão', () => {
    expect(isScryfallCard(normalizeCard(rawCard())!)).toBe(true);
    expect(isScryfallCard({ name: 'Sol Ring' })).toBe(false);
  });
});

describe('completar cartas que só têm nome', () => {
  const bilbo: ScryfallCard = {
    scryfallId: 'abc',
    name: "Bilbo's Deadly Slice",
    manaCost: '{1}{B}',
    cmc: 2,
    typeLine: 'Instant',
    colors: ['B'],
    setCode: 'ltr',
    artCropUrl: 'http://art/bilbo.jpg',
  };
  const found = new Map([[cardNameKey(bilbo.name), bilbo]]);

  it('a chave ignora a pontuação que o OCR come', () => {
    expect(cardNameKey("Bilbo's Deadly Slice")).toBe(cardNameKey('Bilbos Deadly Slice'));
    expect(cardNameKey('Dori, Bearer of friends')).toBe(cardNameKey('Dori Bearer of Friends'));
  });

  it('preenche tipo, custo, cores e arte — sem isto o deck não se analisa', () => {
    const lista: DeckCard[] = [{ name: "Bilbo's deadly slice", quantity: 2 }];
    const [card] = completeFromCatalogue(lista, found);

    expect(card).toMatchObject({
      scryfallId: 'abc',
      name: "Bilbo's Deadly Slice",
      typeLine: 'Instant',
      cmc: 2,
      artCropUrl: 'http://art/bilbo.jpg',
    });
  });

  it('a quantidade é do utilizador e não se toca', () => {
    const lista: DeckCard[] = [{ name: "Bilbo's Deadly Slice", quantity: 3 }];
    expect(completeFromCatalogue(lista, found)[0].quantity).toBe(3);
  });

  it('uma carta do sideboard continua no sideboard', () => {
    const lista: DeckCard[] = [{ name: "Bilbo's Deadly Slice", quantity: 1, board: 'side' }];
    expect(completeFromCatalogue(lista, found)[0].board).toBe('side');
  });

  it('uma carta que já tem impressão escolhida fica como está', () => {
    // Escolher outra impressão só porque o nome bate certo desfazia uma decisão de alguém.
    const lista: DeckCard[] = [{ name: "Bilbo's Deadly Slice", quantity: 1, scryfallId: 'outra' }];
    expect(completeFromCatalogue(lista, found)[0].scryfallId).toBe('outra');
  });

  it('o que a Scryfall não conhece fica intacto, e não desaparece', () => {
    const lista: DeckCard[] = [{ name: 'Carta Inventada', quantity: 1 }];
    expect(completeFromCatalogue(lista, found)).toEqual(lista);
  });

  it('namesToResolve traz só as que ainda não têm impressão, sem repetir', () => {
    const lista: DeckCard[] = [
      { name: 'Mountain', quantity: 8 },
      { name: 'Mountain', quantity: 2, board: 'side' },
      { name: 'The Black Arrow', quantity: 1, scryfallId: 'ja-tem' },
    ];
    expect(namesToResolve(lista)).toEqual(['Mountain']);
  });
});

describe('completar cartas com impressão já escolhida', () => {
  const arrow: ScryfallCard = {
    scryfallId: 'arrow-1',
    name: 'The Black Arrow',
    manaCost: '{3}',
    cmc: 3,
    typeLine: 'Artifact — Equipment',
    setCode: 'ltr',
    artCropUrl: 'http://art/arrow.jpg',
  };
  const byId = new Map([[arrow.scryfallId, arrow]]);

  it('uma carta a que falta o set precisa de ser refrescada', () => {
    // O caso real: cartas gravadas antes de o `setCode` existir no schema.
    const lista: DeckCard[] = [{ name: 'The Black Arrow', quantity: 2, scryfallId: 'arrow-1', typeLine: 'Artifact' }];
    expect(printingsToRefresh(lista)).toEqual(['arrow-1']);
  });

  it('uma carta completa não é perguntada outra vez', () => {
    const lista: DeckCard[] = [
      { name: 'The Black Arrow', quantity: 1, scryfallId: 'arrow-1', setCode: 'ltr', typeLine: 'Artifact' },
    ];
    expect(printingsToRefresh(lista)).toEqual([]);
  });

  it('uma carta só com nome não entra aqui — essa resolve-se pelo nome', () => {
    expect(printingsToRefresh([{ name: 'Sol Ring', quantity: 1 }])).toEqual([]);
  });

  it('preenche sem trocar a impressão nem a quantidade', () => {
    const lista: DeckCard[] = [{ name: 'The Black Arrow', quantity: 2, scryfallId: 'arrow-1' }];
    const [card] = completeFromPrintings(lista, byId);

    expect(card).toMatchObject({ scryfallId: 'arrow-1', setCode: 'ltr', quantity: 2 });
  });
});
