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
import { opponentNames, parseEvent, parseOpponents, serializeEvent, serializeOpponents } from './repoFiles.ts';
import type { Event, Opponent } from '../types';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const schema = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'schema', name), 'utf8'));

const validateEvent = ajv.compile(schema('event.schema.json'));
const validateOpponents = ajv.compile(schema('opponents.schema.json'));

const fullEvent: Event = {
  id: '2026-04-12-fnm-sealed-aetherdrift',
  name: 'FNM Sealed — Aetherdrift',
  type: 'Sealed',
  setCode: 'dft',
  date: '2026-04-12',
  location: 'Nave Espacial, Lisboa',
  status: 'completed',
  rank: '3rd',
  playersCount: 16,
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
        { number: 1, result: 'W', wentFirst: true },
        { number: 2, result: 'L', wentFirst: false },
        { number: 3, result: 'W', wentFirst: true },
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
