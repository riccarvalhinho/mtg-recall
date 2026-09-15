import { describe, expect, it } from 'vitest';
import { eventColors, eventPlaysColor, hasColors, hasOwnColors } from './eventColors';
import type { Deck, Event } from '../types';

function event(patch: Partial<Event> = {}): Event {
  return {
    id: '2026-01-10-fnm',
    name: 'FNM',
    type: 'Modern',
    date: '2026-01-10',
    status: 'completed',
    matches: [],
    ...patch,
  };
}

function deck(patch: Partial<Deck> = {}): Deck {
  return {
    id: 'jeskai-control',
    name: 'Jeskai Control',
    colors: { main: ['W', 'U', 'R'], splash: [] },
    ...patch,
  };
}

describe('hasColors', () => {
  it('sem selecção é falso', () => {
    expect(hasColors(undefined)).toBe(false);
  });

  it('uma selecção vazia conta como ausência', () => {
    expect(hasColors({ main: [], splash: [] })).toBe(false);
  });

  it('um splash sozinho já é uma selecção', () => {
    expect(hasColors({ main: [], splash: ['R'] })).toBe(true);
  });
});

describe('eventColors', () => {
  it('sem cores e sem deck não há nada a desenhar', () => {
    expect(eventColors(event(), [])).toBeUndefined();
  });

  it('as cores escritas à mão são as que valem', () => {
    const colors = { main: ['W', 'U'] as const, splash: ['R'] as const };
    expect(eventColors(event({ deckColors: { main: ['W', 'U'], splash: ['R'] } }), [])).toEqual(colors);
  });

  it('sem cores próprias, herda as do deck ligado', () => {
    const result = eventColors(event({ deckId: 'jeskai-control' }), [deck()]);
    expect(result).toEqual({ main: ['W', 'U', 'R'], splash: [] });
  });

  // É o ponto do ADR 0013: a decklist não sabe o que foi splash, quem jogou sabe.
  it('as cores próprias ganham às do deck, splash incluído', () => {
    const result = eventColors(
      event({ deckId: 'jeskai-control', deckColors: { main: ['W', 'U'], splash: ['R'] } }),
      [deck()],
    );
    expect(result).toEqual({ main: ['W', 'U'], splash: ['R'] });
  });

  // Limpar os pips não pode apagar as cores do deck por baixo.
  it('cores próprias vazias deixam o deck responder', () => {
    const result = eventColors(
      event({ deckId: 'jeskai-control', deckColors: { main: [], splash: [] } }),
      [deck()],
    );
    expect(result).toEqual({ main: ['W', 'U', 'R'], splash: [] });
  });

  it('um deckId que não existe não inventa cores', () => {
    expect(eventColors(event({ deckId: 'deck-apagado' }), [deck()])).toBeUndefined();
  });

  it('um deck ligado sem cores nenhumas é o mesmo que não ter deck', () => {
    const empty = deck({ colors: { main: [], splash: [] } });
    expect(eventColors(event({ deckId: 'jeskai-control' }), [empty])).toBeUndefined();
  });
});

describe('hasOwnColors', () => {
  it('distingue o que foi escrito do que foi herdado', () => {
    expect(hasOwnColors(event({ deckColors: { main: ['G'], splash: [] } }))).toBe(true);
    expect(hasOwnColors(event({ deckId: 'jeskai-control' }))).toBe(false);
  });
});

describe('eventPlaysColor', () => {
  it('encontra a cor pelo deck ligado, que era o que faltava', () => {
    expect(eventPlaysColor(event({ deckId: 'jeskai-control' }), [deck()], 'U')).toBe(true);
  });

  it('um splash não faz do torneio um torneio dessa cor', () => {
    const played = event({ deckColors: { main: ['W', 'U'], splash: ['R'] } });
    expect(eventPlaysColor(played, [], 'R')).toBe(false);
    expect(eventPlaysColor(played, [], 'W')).toBe(true);
  });

  it('um evento sem cores não conta para cor nenhuma', () => {
    expect(eventPlaysColor(event(), [], 'G')).toBe(false);
  });
});
