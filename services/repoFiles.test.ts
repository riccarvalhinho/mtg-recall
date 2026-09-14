/**
 * O teste que guarda a fronteira: o que a app escreve tem de passar no mesmo schema que o CI usa.
 *
 * Sem isto, um campo a mais ou uma chave com o nome errado só apareceria depois do commit, no
 * `npm run validate` — e entretanto a app continuaria a escrever ficheiros inválidos.
 */
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import {
  opponentNames,
  parseDeck,
  parseEvent,
  parseOpponents,
  parseCollection,
  serializeCollection,
  serializeDeck,
  serializeEvent,
  serializeOpponents,
} from './repoFiles.ts';
import type { CollectionCard, Deck, Event, Opponent } from '../types';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const schema = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'schema', name), 'utf8'));

const validateEvent = ajv.compile(schema('event.schema.json'));
const validateOpponents = ajv.compile(schema('opponents.schema.json'));
const validateDeck = ajv.compile(schema('deck.schema.json'));
const validateCollection = ajv.compile(schema('collection.schema.json'));

const fullEvent: Event = {
  id: '2026-04-12-fnm-sealed-aetherdrift',
  name: 'FNM Sealed — Aetherdrift',
  type: 'Sealed',
  setCode: 'dft',
  date: '2026-04-12',
  location: 'Nave Espacial, Lisboa',
  status: 'completed',
  placement: 3,
  playersCount: 16,
  deckId: 'selesnya-midrange',
  deckName: 'Selesnya Midrange',
  deckColors: { main: ['G', 'W'], splash: ['U'] },
  notes: 'Pool fraco de removal.',
  matches: [
    {
      round: 1,
      opponentId: 'joao-ferreira',
      opponent: 'João Ferreira',
      opponentColors: { main: ['U', 'B'], splash: [] },
      result: 'W',
      wentFirst: true,
      games: [
        { number: 1, result: 'W', wentFirst: true, life: { me: 14, opponent: 0 } },
        { number: 2, result: 'L', wentFirst: false, life: { me: 3, opponent: 20 } },
        { number: 3, result: 'W', wentFirst: true, life: { me: 12, opponent: 7 } },
      ],
      notes: 'Removal a mais do outro lado no game 2.',
    },
  ],
};

/** O mínimo que a app escreve: um evento acabado de criar, sem deck nem matches. */
const minimalEvent: Event = {
  id: '2026-04-12-draft',
  name: 'Draft',
  type: 'Draft',
  date: '2026-04-12',
  status: 'active',
  matches: [],
};

function parsed(event: Event): unknown {
  return JSON.parse(serializeEvent(event));
}

describe('serializeEvent', () => {
  it('produz um evento que passa no schema do repositório', () => {
    expect(validateEvent(parsed(fullEvent))).toBe(true);
  });

  it('produz um evento mínimo que passa no schema', () => {
    expect(validateEvent(parsed(minimalEvent))).toBe(true);
  });

  it('não guarda o nome do adversário dentro do evento', () => {
    // O nome vive só na taxonomia. Duas cópias divergiriam à primeira correcção.
    const content = serializeEvent(fullEvent);
    expect(content).toContain('joao-ferreira');
    expect(content).not.toContain('João Ferreira');
  });

  it('não escreve campos vazios', () => {
    const withBlanks: Event = { ...minimalEvent, location: '   ', rank: '', notes: '' };
    const file = parsed(withBlanks) as Record<string, unknown>;
    expect(file).not.toHaveProperty('location');
    expect(file).not.toHaveProperty('rank');
    expect(file).not.toHaveProperty('notes');
  });

  it('escreve a posição final e o número de jogadores', () => {
    const file = parsed(fullEvent) as Record<string, unknown>;
    expect(file.placement).toBe(3);
    expect(file.playersCount).toBe(16);
  });

  it('continua a escrever o rank antigo dos eventos que só têm isso', () => {
    // Nada novo escreve `rank` (ADR 0012), mas um evento antigo restaurado do repositório volta a
    // ser gravado à primeira alteração — e perder o resultado nessa gravação seria apagá-lo.
    const legacy: Event = { ...minimalEvent, rank: 'Top 8' };
    const file = parsed(legacy) as Record<string, unknown>;
    expect(file.rank).toBe('Top 8');
    expect(validateEvent(file)).toBe(true);
  });

  it('omite deckColors quando não há cor nenhuma escolhida', () => {
    const noColors: Event = { ...minimalEvent, deckColors: { main: [], splash: [] } };
    expect(parsed(noColors)).not.toHaveProperty('deckColors');
  });

  it('escreve os matches por ordem de ronda, mesmo que cheguem desordenados', () => {
    const shuffled: Event = {
      ...minimalEvent,
      matches: [
        { ...fullEvent.matches[0], round: 2 },
        { ...fullEvent.matches[0], round: 1 },
      ],
    };
    const file = parsed(shuffled) as { matches: { round: number }[] };
    expect(file.matches.map((match) => match.round)).toEqual([1, 2]);
  });

  it('escreve a vida com que cada game acabou', () => {
    const event = parsed(fullEvent) as { matches: { games: { life?: unknown }[] }[] };
    expect(event.matches[0].games.map(game => game.life)).toEqual([
      { me: 14, opponent: 0 },
      { me: 3, opponent: 20 },
      { me: 12, opponent: 7 },
    ]);
  });

  it('não escreve a chave life num game registado à mão', () => {
    // Quem carrega um torneio de memória não sabe a vida. Ausente tem de ser mesmo ausente: um
    // `"life": null` no ficheiro seria chumbado pelo schema, que não admite outro tipo.
    const byHand: Event = {
      ...fullEvent,
      matches: [{ ...fullEvent.matches[0], games: [{ number: 1, result: 'W' }] }],
    };
    expect(validateEvent(parsed(byHand))).toBe(true);
    expect(serializeEvent(byHand)).not.toContain('life');
  });

  it('a vida negativa fica como está — perde-se a menos de zero', () => {
    const dead: Event = {
      ...fullEvent,
      matches: [{
        ...fullEvent.matches[0],
        result: 'L',
        games: [
          { number: 1, result: 'L', life: { me: -3, opponent: 11 } },
          { number: 2, result: 'L', life: { me: -1, opponent: 6 } },
        ],
      }],
    };
    expect(validateEvent(parsed(dead))).toBe(true);
    expect(serializeEvent(dead)).toContain('"me": -3');
  });

  it('a vida não fica presa ao objecto que veio do contador', () => {
    // O serializador copia em vez de partilhar: mexer no contador depois de gravar não pode mudar
    // aquilo que já foi escrito.
    const live = { me: 20, opponent: 20 };
    const event: Event = {
      ...fullEvent,
      matches: [{ ...fullEvent.matches[0], games: [{ number: 1, result: 'W', life: live }] }],
    };
    const written = serializeEvent(event);
    live.me = 1;
    expect(written).toContain('"me": 20');
  });

  it('usa dois espaços e acaba com uma linha, como o resto de data/', () => {
    const content = serializeEvent(minimalEvent);
    expect(content.endsWith('}\n')).toBe(true);
    expect(content).toContain('\n  "name": "Draft"');
  });
});

describe('serializeOpponents', () => {
  const opponents: Opponent[] = [
    { id: 'rui-almeida', name: 'Rui Almeida' },
    { id: 'ana-costa', name: 'Ana Costa', notes: 'Joga sempre azul.' },
  ];

  it('produz uma taxonomia que passa no schema', () => {
    expect(validateOpponents(JSON.parse(serializeOpponents(opponents)))).toBe(true);
  });

  it('ordena por nome, para o diff mostrar quem foi acrescentado', () => {
    const file = JSON.parse(serializeOpponents(opponents)) as { items: { id: string }[] };
    expect(file.items.map((item) => item.id)).toEqual(['ana-costa', 'rui-almeida']);
  });

  it('aguenta uma lista vazia — é assim que o ficheiro começa', () => {
    expect(validateOpponents(JSON.parse(serializeOpponents([])))).toBe(true);
  });
});

describe('leitura', () => {
  it('resolve o nome do adversário a partir da taxonomia', () => {
    const names = opponentNames([{ id: 'joao-ferreira', name: 'João Ferreira' }]);
    const event = parseEvent(JSON.parse(serializeEvent(fullEvent)), names);
    expect(event.matches[0].opponent).toBe('João Ferreira');
  });

  it('mostra o id quando o adversário não está na taxonomia, em vez de rebentar', () => {
    const event = parseEvent(JSON.parse(serializeEvent(fullEvent)), new Map());
    expect(event.matches[0].opponent).toBe('joao-ferreira');
  });

  it('sobrevive a uma ida e volta pelo ficheiro sem perder nada', () => {
    const names = opponentNames([{ id: 'joao-ferreira', name: 'João Ferreira' }]);
    const roundTripped = parseEvent(JSON.parse(serializeEvent(fullEvent)), names);
    expect(serializeEvent(roundTripped)).toBe(serializeEvent(fullEvent));
  });

  it('lê a taxonomia que ela própria escreveu', () => {
    const opponents: Opponent[] = [{ id: 'ana-costa', name: 'Ana Costa' }];
    expect(parseOpponents(JSON.parse(serializeOpponents(opponents)))).toEqual(opponents);
  });
});


// ─── Decks ───────────────────────────────────────────────────────────────────

const fullDeck: Deck = {
  id: 'izzet-prowess',
  name: 'Izzet Prowess',
  colors: { main: ['U', 'R'], splash: [] },
  format: 'Modern',
  archetype: 'Prowess aggro',
  notes: 'Contra controlo, entra o pacote de counters.',
  cards: [
    {
      name: 'Ragavan, Nimble Pilferer',
      quantity: 4,
      scryfallId: 'a9738cda-adb1-47fb-9f4c-ecd930228c4d',
      manaCost: '{R}',
      cmc: 1,
      typeLine: 'Legendary Creature — Monkey Pirate',
      colors: ['R'],
    },
    { name: 'Consider', quantity: 4, manaCost: '{U}', cmc: 1, typeLine: 'Instant', colors: ['U'] },
    { name: 'Blood Moon', quantity: 2, board: 'side', manaCost: '{2}{R}', cmc: 3, typeLine: 'Enchantment', colors: ['R'] },
  ],
};

/** O mínimo: um deck acabado de criar, sem cartas nem formato. */
const minimalDeck: Deck = {
  id: 'mono-red',
  name: 'Mono Red',
  colors: { main: ['R'], splash: [] },
};

describe('serializeDeck', () => {
  it('um deck completo passa no schema verdadeiro', () => {
    const written = JSON.parse(serializeDeck(fullDeck));
    expect(validateDeck(written), JSON.stringify(validateDeck.errors)).toBe(true);
  });

  it('um deck sem cartas passa no schema — a lista é opcional de propósito', () => {
    const written = JSON.parse(serializeDeck(minimalDeck));
    expect(validateDeck(written), JSON.stringify(validateDeck.errors)).toBe(true);
    expect(written.cards).toBeUndefined();
  });

  it('não escreve board: "main", que é o valor por omissão do schema', () => {
    const written = JSON.parse(serializeDeck(fullDeck));
    const consider = written.cards.find((card: { name: string }) => card.name === 'Consider');
    expect(consider.board).toBeUndefined();
  });

  it('ordena o sideboard depois do main e cada um por nome', () => {
    const written = JSON.parse(serializeDeck(fullDeck));
    expect(written.cards.map((card: { name: string }) => card.name)).toEqual([
      'Consider',
      'Ragavan, Nimble Pilferer',
      'Blood Moon',
    ]);
  });

  it('dois espaços e uma linha em branco no fim, como os ficheiros de data/', () => {
    const text = serializeDeck(minimalDeck);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "id"');
  });
});

describe('parseDeck', () => {
  it('a ida e volta não perde nada', () => {
    const roundTrip = parseDeck(JSON.parse(serializeDeck(fullDeck)));
    expect(roundTrip.id).toBe(fullDeck.id);
    expect(roundTrip.cards).toHaveLength(3);
    expect(roundTrip.format).toBe('Modern');
  });

  it('um deck sem cores não deita a lista abaixo', () => {
    const deck = parseDeck({ id: 'x', name: 'X' });
    expect(deck.colors).toEqual({ main: [], splash: [] });
  });
});

// ─── Colecção ────────────────────────────────────────────────────────────────

const collection: CollectionCard[] = [
  {
    scryfallId: 'a9738cda-adb1-47fb-9f4c-ecd930228c4d',
    name: 'Ragavan, Nimble Pilferer',
    setCode: 'mh2',
    collectorNumber: '138',
    quantity: 2,
    condition: 'NM',
    acquiredAt: '2026-03-04',
  },
  {
    scryfallId: 'a9738cda-adb1-47fb-9f4c-ecd930228c4d',
    name: 'Ragavan, Nimble Pilferer',
    setCode: 'mh2',
    collectorNumber: '138',
    quantity: 1,
    foil: true,
  },
  { name: 'Consider', quantity: 4 },
];

describe('serializeCollection', () => {
  it('passa no schema verdadeiro', () => {
    const written = JSON.parse(serializeCollection(collection));
    expect(validateCollection(written), JSON.stringify(validateCollection.errors)).toBe(true);
  });

  it('uma colecção vazia continua a ser uma colecção válida', () => {
    const written = JSON.parse(serializeCollection([]));
    expect(validateCollection(written), JSON.stringify(validateCollection.errors)).toBe(true);
    expect(written.items).toEqual([]);
  });

  it('não escreve foil: false, que é o valor por omissão do schema', () => {
    const written = JSON.parse(serializeCollection(collection));
    const naoFoil = written.items.find(
      (card: { name: string; foil?: boolean }) => card.name === 'Consider',
    );
    expect(naoFoil.foil).toBeUndefined();
  });

  it('ordena por nome — o diff tem de mostrar a carta acrescentada, não a lista reordenada', () => {
    const written = JSON.parse(serializeCollection(collection));
    expect(written.items[0].name).toBe('Consider');
  });

  it('a versão foil e a normal ficam ambas, como entradas separadas', () => {
    const written = JSON.parse(serializeCollection(collection));
    const ragavans = written.items.filter(
      (card: { name: string }) => card.name === 'Ragavan, Nimble Pilferer',
    );
    expect(ragavans).toHaveLength(2);
  });

  it('a ida e volta não perde nada', () => {
    const roundTrip = parseCollection(JSON.parse(serializeCollection(collection)));
    expect(roundTrip).toHaveLength(3);
    expect(roundTrip.find(card => card.foil)?.quantity).toBe(1);
  });
});
