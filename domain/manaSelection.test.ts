import { describe, expect, it } from 'vitest';
import {
  cycleManaState,
  emptyManaStates,
  hasAnyMana,
  manaSelectionFrom,
  manaStatesFrom,
} from './manaSelection';
import type { ManaSelection } from '../types';

describe('manaStatesFrom', () => {
  it('sem selecção devolve tudo desligado', () => {
    expect(manaStatesFrom(undefined)).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0 });
  });

  it('separa principais de splashes', () => {
    expect(manaStatesFrom({ main: ['U', 'B'], splash: ['R'] })).toEqual({
      W: 0, U: 1, B: 1, R: 2, G: 0,
    });
  });

  it('uma cor nas duas listas fica como splash', () => {
    expect(manaStatesFrom({ main: ['G'], splash: ['G'] }).G).toBe(2);
  });
});

describe('cycleManaState', () => {
  it('percorre off → main → splash → off', () => {
    let states = emptyManaStates();
    states = cycleManaState(states, 'R');
    expect(states.R).toBe(1);
    states = cycleManaState(states, 'R');
    expect(states.R).toBe(2);
    states = cycleManaState(states, 'R');
    expect(states.R).toBe(0);
  });

  it('não mexe nas outras cores', () => {
    const states = cycleManaState({ W: 1, U: 0, B: 2, R: 0, G: 0 }, 'U');
    expect(states).toEqual({ W: 1, U: 1, B: 2, R: 0, G: 0 });
  });
});

describe('manaSelectionFrom', () => {
  it('devolve as listas em WUBRG, não pela ordem dos toques', () => {
    expect(manaSelectionFrom({ W: 0, U: 1, B: 2, R: 1, G: 0 })).toEqual({
      main: ['U', 'R'],
      splash: ['B'],
    });
  });

  it('sem cores devolve listas vazias', () => {
    expect(manaSelectionFrom(emptyManaStates())).toEqual({ main: [], splash: [] });
  });

  it('é o inverso de manaStatesFrom', () => {
    const selection: ManaSelection = { main: ['W', 'G'], splash: ['U'] };
    expect(manaSelectionFrom(manaStatesFrom(selection))).toEqual({
      main: ['W', 'G'],
      splash: ['U'],
    });
  });
});

describe('hasAnyMana', () => {
  it('é falso sem cores e verdadeiro com uma só, mesmo que splash', () => {
    expect(hasAnyMana(emptyManaStates())).toBe(false);
    expect(hasAnyMana({ W: 0, U: 0, B: 0, R: 0, G: 2 })).toBe(true);
  });
});
